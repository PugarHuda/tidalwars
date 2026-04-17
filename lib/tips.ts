import { kget, kset } from './kv'
import { getPoints, addPointsResult as _addResult } from './points'
import { randomUUID } from 'crypto'

/**
 * Tipping — watchers gift their accumulated Tidal Points to traders
 * during a live arena. Zero blockchain: points are our off-chain
 * engagement currency. Purely additive to the trader's arena score.
 *
 * Design:
 *   - Spender's global Tidal Points balance decreases (Redis tidal_points:USER)
 *   - Recipient's arena tip total increases (Redis tips:COMP)
 *   - Event appended to Redis list (tipsFeed:COMP) for real-time animation
 *   - At settle, tips_received adds to rank bonus (trader earns more points)
 *
 * When/if we add real-money tipping:
 *   - Swap "points deduction" for Solana SPL token transfer (USDC to trader)
 *   - No contract required — plain `Token.transfer()` from wallet
 *   - This module stays — becomes the "points" tip track alongside USDC
 */

export interface TipEvent {
  id: string
  competitionId: string
  fromUserId: string
  fromDisplayName: string
  toUserId: string
  toDisplayName: string
  amount: number
  timestamp: number
}

export interface SpenderBacking {
  total: number                               // total points spent tipping in this arena
  backed: Record<string, number>              // toUserId → amount tipped to them
  displayName: string                         // cache tipper's display name for settle kickback UX
}

export interface TipState {
  totals: Record<string, number>              // toUserId → cumulative tips received
  bySpender: Record<string, SpenderBacking>   // fromUserId → their backing positions
  events: TipEvent[]                          // capped at 50 most-recent
  kickbackedAt?: number                       // set when settle credits kickbacks (prevent double-credit)
}

const CAP = 50

const tipsMem: Map<string, TipState> = new Map()

async function loadState(competitionId: string): Promise<TipState> {
  const cached = tipsMem.get(competitionId)
  if (cached) return cached
  const raw = await kget<unknown>(`tips:${competitionId}`)
  let parsed: TipState = { totals: {}, bySpender: {}, events: [] }
  if (raw) {
    try {
      parsed = typeof raw === 'object' ? (raw as TipState) : (JSON.parse(raw as string) as TipState)
      if (!parsed.bySpender) parsed.bySpender = {}  // migration for pre-kickback shape
    } catch { /* use empty */ }
  }
  tipsMem.set(competitionId, parsed)
  return parsed
}

async function saveState(competitionId: string, state: TipState): Promise<void> {
  tipsMem.set(competitionId, state)
  await kset(`tips:${competitionId}`, JSON.stringify(state), 60 * 60 * 24)
}

export async function getTips(competitionId: string): Promise<TipState> {
  return loadState(competitionId)
}

/**
 * Tip flow:
 *   1. Check spender has >= amount in global Tidal Points
 *   2. Deduct from spender's persistent points
 *   3. Credit recipient's arena tip total + append event
 *   4. Save both atomically-ish (best-effort on Redis)
 */
export async function sendTip(params: {
  competitionId: string
  fromUserId: string
  fromDisplayName: string
  toUserId: string
  toDisplayName: string
  amount: number
}): Promise<{
  ok: boolean
  error?: string
  event?: TipEvent
  newFromBalance?: number
  newToTotal?: number
}> {
  const amount = Math.floor(Math.max(0, params.amount))
  if (amount <= 0) return { ok: false, error: 'Amount must be positive' }
  if (params.fromUserId === params.toUserId) return { ok: false, error: "You can't tip yourself" }

  const fromPoints = await getPoints(params.fromUserId)
  if (!fromPoints || fromPoints.totalPoints < amount) {
    return { ok: false, error: `Insufficient Tidal Points (you have ${fromPoints?.totalPoints ?? 0}, need ${amount})` }
  }

  // Deduct from spender — save directly to avoid addPointsResult recomputing arena stats
  const nextFrom = { ...fromPoints, totalPoints: fromPoints.totalPoints - amount, updatedAt: Date.now() }
  await kset(`tidal_points:${params.fromUserId}`, JSON.stringify(nextFrom), 60 * 60 * 24 * 30)

  // Credit recipient's arena tip total + track spender's backing + record event
  const state = await loadState(params.competitionId)
  state.totals[params.toUserId] = (state.totals[params.toUserId] ?? 0) + amount

  // Track the tipper's backing position — used at settle for kickback math
  if (!state.bySpender[params.fromUserId]) {
    state.bySpender[params.fromUserId] = { total: 0, backed: {}, displayName: params.fromDisplayName }
  }
  const spender = state.bySpender[params.fromUserId]
  spender.total += amount
  spender.backed[params.toUserId] = (spender.backed[params.toUserId] ?? 0) + amount
  spender.displayName = params.fromDisplayName  // keep latest

  const event: TipEvent = {
    id: randomUUID(),
    competitionId: params.competitionId,
    fromUserId: params.fromUserId,
    fromDisplayName: params.fromDisplayName,
    toUserId: params.toUserId,
    toDisplayName: params.toDisplayName,
    amount,
    timestamp: Date.now(),
  }
  state.events.unshift(event)
  if (state.events.length > CAP) state.events.pop()
  await saveState(params.competitionId, state)

  // Silence unused import lint (_addResult is exported but not used in tip path)
  void _addResult

  return {
    ok: true,
    event,
    newFromBalance: nextFrom.totalPoints,
    newToTotal: state.totals[params.toUserId],
  }
}

export interface KickbackResult {
  tipperUserId: string
  displayName: string
  backedUserId: string
  backedDisplayName: string
  tipped: number
  kickback: number
  backedRank: number
}

/**
 * At settle, iterate every tipper's backed positions. Award kickback based
 * on the rank their backed trader finished at:
 *   rank 1 → 2× tipped  (winner — massive backing payoff)
 *   rank 2 → 1.5× tipped
 *   rank 3 → 1× tipped  (break-even refund)
 *   other → 0 (tip forfeit)
 *
 * Idempotent via state.kickbackedAt — second call returns [].
 */
export async function computeKickbacks(
  competitionId: string,
  finalRanks: Record<string, number>,          // userId → rank
  participantNames: Record<string, string>,    // userId → displayName
): Promise<KickbackResult[]> {
  const state = await loadState(competitionId)
  if (state.kickbackedAt) return []  // already processed

  const results: KickbackResult[] = []
  for (const [tipperUserId, spender] of Object.entries(state.bySpender)) {
    for (const [backedUserId, tipped] of Object.entries(spender.backed)) {
      const rank = finalRanks[backedUserId]
      if (rank === undefined) continue
      const mult = rank === 1 ? 2 : rank === 2 ? 1.5 : rank === 3 ? 1 : 0
      const kickback = Math.floor(tipped * mult)
      if (kickback > 0) {
        results.push({
          tipperUserId, displayName: spender.displayName,
          backedUserId, backedDisplayName: participantNames[backedUserId] ?? backedUserId.slice(0, 6),
          tipped, kickback, backedRank: rank,
        })
      }
    }
  }

  state.kickbackedAt = Date.now()
  await saveState(competitionId, state)
  return results
}
