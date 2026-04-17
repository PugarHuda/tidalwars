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

export interface TipState {
  totals: Record<string, number>  // toUserId → cumulative tips received (points)
  events: TipEvent[]              // capped at 50 most-recent
}

const CAP = 50

const tipsMem: Map<string, TipState> = new Map()

async function loadState(competitionId: string): Promise<TipState> {
  const cached = tipsMem.get(competitionId)
  if (cached) return cached
  const raw = await kget<unknown>(`tips:${competitionId}`)
  let parsed: TipState = { totals: {}, events: [] }
  if (raw) {
    try {
      parsed = typeof raw === 'object' ? (raw as TipState) : (JSON.parse(raw as string) as TipState)
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

  // Credit recipient's arena tip total + record event
  const state = await loadState(params.competitionId)
  state.totals[params.toUserId] = (state.totals[params.toUserId] ?? 0) + amount
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
