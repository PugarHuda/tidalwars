export type Side = 'bid' | 'ask'

export interface Position {
  symbol: string
  side: Side
  entryPrice: number
  amount: number
  leverage: number
  openedAt: number
  clientOrderId: string
}

export interface Participant {
  userId: string
  displayName: string
  walletAddress: string
  positions: Position[]
  realizedPnl: number
  joinedAt: number
}

export interface Competition {
  id: string
  name: string
  creatorId: string
  startsAt: number
  endsAt: number
  durationMinutes: number
  startingBalance: number // virtual USDC
  allowedSymbols: string[]
  maxLeverage: number
  status: 'waiting' | 'active' | 'ended'
  participants: Record<string, Participant>
  createdAt: number
}

export interface LeaderboardEntry {
  userId: string
  displayName: string
  walletAddress: string
  unrealizedPnl: number
  realizedPnl: number
  totalPnl: number
  roi: number
  positionCount: number
  rank: number
}

export interface TradeEvent {
  id: string
  competitionId: string
  userId: string
  displayName: string
  symbol: string
  side: Side
  amount: number
  price: number
  leverage: number
  action: 'open' | 'close'
  pnl?: number
  pacificaOrderId?: string  // real on-chain order ID when executed on Pacifica
  timestamp: number
}

export interface PriceData {
  symbol: string
  price: number
  change24h: number
  updatedAt: number
}
