import { Competition, TradeEvent, Participant } from './types'
import { randomUUID } from 'crypto'

/**
 * Persist state in globalThis so it survives Turbopack HMR module re-evaluation.
 * Without this, changing any file in the import chain would create a fresh Map,
 * losing all in-flight competitions. This is dev-only behaviour; prod builds
 * evaluate modules exactly once.
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

const competitions      = g.__pw_competitions
const tradeEvents       = g.__pw_tradeEvents
const settledCompetitions = g.__pw_settled
// lastKnownPrices is mutable — access via getter/setter below
const _pricesRef = g

export function updateLastKnownPrices(prices: Record<string, number>) {
  _pricesRef.__pw_prices = { ..._pricesRef.__pw_prices, ...prices }
}

export function getLastKnownPrices(): Record<string, number> {
  return _pricesRef.__pw_prices ?? {}
}

export const ALLOWED_SYMBOLS = ['BTC', 'ETH', 'SOL', 'WIF', 'BONK']
export const STARTING_BALANCE = 10000 // $10,000 virtual USDC

export function createCompetition(params: {
  name: string
  creatorId: string
  durationMinutes: number
  allowedSymbols?: string[]
  maxLeverage?: number
}): Competition {
  const id = randomUUID()
  const now = Date.now()
  const comp: Competition = {
    id,
    name: params.name,
    creatorId: params.creatorId,
    startsAt: now,
    endsAt: now + params.durationMinutes * 60 * 1000,
    durationMinutes: params.durationMinutes,
    startingBalance: STARTING_BALANCE,
    allowedSymbols: params.allowedSymbols ?? ALLOWED_SYMBOLS,
    maxLeverage: params.maxLeverage ?? 10,
    status: 'active',
    participants: {},
    createdAt: now,
  }
  competitions.set(id, comp)
  tradeEvents.set(id, [])
  return comp
}

export function settleCompetition(id: string, prices?: Record<string, number>): void {
  const comp = competitions.get(id)
  if (!comp || settledCompetitions.has(id)) return

  settledCompetitions.add(id)
  comp.status = 'ended'

  const settlePrices = prices ?? getLastKnownPrices()

  // Auto-close all open positions at current market prices
  for (const [userId, participant] of Object.entries(comp.participants)) {
    const openPositions = [...participant.positions]
    for (const pos of openPositions) {
      const exitPrice = settlePrices[pos.symbol] ?? pos.entryPrice
      const priceDiff = pos.side === 'bid'
        ? exitPrice - pos.entryPrice
        : pos.entryPrice - exitPrice
      const pnl = priceDiff * pos.amount * pos.leverage

      participant.realizedPnl += pnl

      addTradeEvent(id, {
        id: randomUUID(),
        competitionId: id,
        userId,
        displayName: participant.displayName,
        symbol: pos.symbol,
        side: pos.side,
        amount: pos.amount,
        price: exitPrice,
        leverage: pos.leverage,
        action: 'close',
        pnl,
        timestamp: Date.now(),
      })
    }
    participant.positions = []
  }
}

export function getCompetition(id: string): Competition | undefined {
  const comp = competitions.get(id)
  if (!comp) return undefined
  // Auto-settle when time expires
  if (comp.status === 'active' && Date.now() > comp.endsAt) {
    settleCompetition(id)
  }
  return comp
}

export function getAllCompetitions(): Competition[] {
  return Array.from(competitions.values())
    .map(comp => {
      if (comp.status === 'active' && Date.now() > comp.endsAt) {
        comp.status = 'ended'
      }
      return comp
    })
    .sort((a, b) => b.createdAt - a.createdAt)
}

export function joinCompetition(competitionId: string, participant: Participant): boolean {
  const comp = competitions.get(competitionId)
  if (!comp || comp.status === 'ended') return false
  comp.participants[participant.userId] = participant
  return true
}

export function addTradeEvent(competitionId: string, event: TradeEvent): void {
  const events = tradeEvents.get(competitionId) ?? []
  events.unshift(event) // newest first
  if (events.length > 100) events.pop() // keep last 100
  tradeEvents.set(competitionId, events)
}

export function getTradeEvents(competitionId: string): TradeEvent[] {
  return tradeEvents.get(competitionId) ?? []
}

export function updateParticipantPnl(
  competitionId: string,
  userId: string,
  realizedPnl: number
): void {
  const comp = competitions.get(competitionId)
  if (!comp || !comp.participants[userId]) return
  comp.participants[userId].realizedPnl += realizedPnl
}

export function addParticipantPosition(
  competitionId: string,
  userId: string,
  position: Participant['positions'][0]
): void {
  const comp = competitions.get(competitionId)
  if (!comp || !comp.participants[userId]) return
  comp.participants[userId].positions.push(position)
}

export function removeParticipantPosition(
  competitionId: string,
  userId: string,
  clientOrderId: string
): Participant['positions'][0] | undefined {
  const comp = competitions.get(competitionId)
  if (!comp || !comp.participants[userId]) return undefined
  const positions = comp.participants[userId].positions
  const idx = positions.findIndex(p => p.clientOrderId === clientOrderId)
  if (idx === -1) return undefined
  const [removed] = positions.splice(idx, 1)
  return removed
}
