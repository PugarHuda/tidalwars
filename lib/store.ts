import { Competition, TradeEvent, Participant } from './types'
import { kget, kset, ksadd, ksmembers } from './kv'
import { randomUUID } from 'crypto'

/**
 * Hybrid store: in-memory (fast) + Upstash Redis (persistent across Lambda instances).
 * When Redis is not configured, falls back to pure in-memory (local dev).
 * globalThis keeps data alive across Turbopack HMR re-evaluations in dev.
 */
type GlobalStore = {
  __pw_competitions: Map<string, Competition>
  __pw_tradeEvents: Map<string, TradeEvent[]>
  __pw_settled: Set<string>
  __pw_prices: Record<string, number>
}
const g = globalThis as typeof globalThis & Partial<GlobalStore>
if (!g.__pw_competitions) g.__pw_competitions = new Map()
if (!g.__pw_tradeEvents)  g.__pw_tradeEvents  = new Map()
if (!g.__pw_settled)      g.__pw_settled      = new Set()
if (!g.__pw_prices)       g.__pw_prices       = {}

const competitions        = g.__pw_competitions!
const tradeEvents         = g.__pw_tradeEvents!
const settledCompetitions = g.__pw_settled!

export const ALLOWED_SYMBOLS = ['BTC', 'ETH', 'SOL', 'WIF', 'BONK']
export const STARTING_BALANCE = 10000

// ── Redis persistence helpers ──────────────────────────────────────────────────

const TTL = 60 * 60 * 24 // 24h

async function saveComp(comp: Competition): Promise<void> {
  competitions.set(comp.id, comp)
  await kset(`comp:${comp.id}`, JSON.stringify(comp), TTL)
}

async function saveEvents(id: string, events: TradeEvent[]): Promise<void> {
  tradeEvents.set(id, events)
  await kset(`events:${id}`, JSON.stringify(events), TTL)
}

async function loadComp(id: string): Promise<Competition | undefined> {
  let comp = competitions.get(id)
  if (comp) return comp
  const raw = await kget<unknown>(`comp:${id}`)
  if (!raw) return undefined
  try {
    comp = typeof raw === 'object' ? (raw as Competition) : (JSON.parse(raw as string) as Competition)
    competitions.set(id, comp)
  } catch { return undefined }
  return comp
}

async function loadEvents(id: string): Promise<TradeEvent[]> {
  let events = tradeEvents.get(id)
  if (events) return events
  const raw = await kget<unknown>(`events:${id}`)
  events = []
  if (raw) {
    try {
      events = typeof raw === 'object' ? (raw as TradeEvent[]) : (JSON.parse(raw as string) as TradeEvent[])
    } catch { /* corrupt */ }
  }
  tradeEvents.set(id, events)
  return events
}

// ── Prices (in-memory only — refreshed by /api/prices polling) ────────────────

export function updateLastKnownPrices(prices: Record<string, number>) {
  g.__pw_prices = { ...g.__pw_prices, ...prices }
}

export function getLastKnownPrices(): Record<string, number> {
  return g.__pw_prices ?? {}
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function createCompetition(params: {
  name: string
  creatorId: string
  durationMinutes: number
  startDelaySeconds?: number   // If >0, arena opens in lobby state until startsAt
  allowedSymbols?: string[]
  maxLeverage?: number
}): Promise<Competition> {
  const id = randomUUID()
  const now = Date.now()
  const delay = Math.max(0, params.startDelaySeconds ?? 0) * 1000
  const startsAt = now + delay
  const comp: Competition = {
    id,
    name: params.name,
    creatorId: params.creatorId,
    startsAt,
    endsAt: startsAt + params.durationMinutes * 60 * 1000,
    durationMinutes: params.durationMinutes,
    startingBalance: STARTING_BALANCE,
    allowedSymbols: params.allowedSymbols ?? ALLOWED_SYMBOLS,
    maxLeverage: params.maxLeverage ?? 10,
    status: delay > 0 ? 'waiting' : 'active',
    participants: {},
    createdAt: now,
  }
  tradeEvents.set(id, [])
  await Promise.all([
    saveComp(comp),
    saveEvents(id, []),
    ksadd('comp_ids', id),
  ])
  return comp
}

export async function settleCompetition(id: string, prices?: Record<string, number>): Promise<void> {
  const comp = await loadComp(id)
  if (!comp || settledCompetitions.has(id)) return
  settledCompetitions.add(id)
  comp.status = 'ended'

  const settlePrices = prices ?? getLastKnownPrices()
  const events = await loadEvents(id)

  for (const [userId, participant] of Object.entries(comp.participants)) {
    for (const pos of [...participant.positions]) {
      const exitPrice = settlePrices[pos.symbol] ?? pos.entryPrice
      const priceDiff = pos.side === 'bid' ? exitPrice - pos.entryPrice : pos.entryPrice - exitPrice
      const pnl = priceDiff * pos.amount * pos.leverage
      participant.realizedPnl += pnl
      events.unshift({
        id: randomUUID(), competitionId: id, userId,
        displayName: participant.displayName,
        symbol: pos.symbol, side: pos.side,
        amount: pos.amount, price: exitPrice, leverage: pos.leverage,
        action: 'close', pnl, timestamp: Date.now(),
      })
    }
    participant.positions = []
  }

  await Promise.all([saveComp(comp), saveEvents(id, events)])
}

export async function getCompetition(id: string): Promise<Competition | undefined> {
  const comp = await loadComp(id)
  if (!comp) return undefined
  const now = Date.now()
  // Auto-flip waiting → active when startsAt hits (persist the status change)
  if (comp.status === 'waiting' && now >= comp.startsAt) {
    comp.status = 'active'
    await saveComp(comp)
  }
  if (comp.status === 'active' && now > comp.endsAt) {
    await settleCompetition(id)
    return competitions.get(id)
  }
  return comp
}

export async function getAllCompetitions(): Promise<Competition[]> {
  const ids = await ksmembers('comp_ids')
  await Promise.all(ids.map(id => loadComp(id)))

  const now = Date.now()
  return Array.from(competitions.values())
    .map(comp => {
      if (comp.status === 'waiting' && now >= comp.startsAt) comp.status = 'active'
      if (comp.status === 'active' && now > comp.endsAt) comp.status = 'ended'
      return comp
    })
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function joinCompetition(competitionId: string, participant: Participant): Promise<boolean> {
  const comp = await loadComp(competitionId)
  if (!comp || comp.status === 'ended') return false
  comp.participants[participant.userId] = participant
  await saveComp(comp)
  return true
}

export async function addTradeEvent(competitionId: string, event: TradeEvent): Promise<void> {
  const events = await loadEvents(competitionId)
  events.unshift(event)
  if (events.length > 100) events.pop()
  await saveEvents(competitionId, events)
}

export async function getTradeEvents(competitionId: string): Promise<TradeEvent[]> {
  return loadEvents(competitionId)
}

export async function updateParticipantPnl(competitionId: string, userId: string, realizedPnl: number): Promise<void> {
  const comp = await loadComp(competitionId)
  if (!comp || !comp.participants[userId]) return
  comp.participants[userId].realizedPnl += realizedPnl
  await saveComp(comp)
}

export async function addParticipantPosition(
  competitionId: string,
  userId: string,
  position: Participant['positions'][0]
): Promise<void> {
  const comp = await loadComp(competitionId)
  if (!comp || !comp.participants[userId]) return
  comp.participants[userId].positions.push(position)
  await saveComp(comp)
}

export async function removeParticipantPosition(
  competitionId: string,
  userId: string,
  clientOrderId: string
): Promise<Participant['positions'][0] | undefined> {
  const comp = await loadComp(competitionId)
  if (!comp || !comp.participants[userId]) return undefined
  const positions = comp.participants[userId].positions
  const idx = positions.findIndex(p => p.clientOrderId === clientOrderId)
  if (idx === -1) return undefined
  const [removed] = positions.splice(idx, 1)
  await saveComp(comp)
  return removed
}
