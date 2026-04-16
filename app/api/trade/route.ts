import { NextRequest, NextResponse } from 'next/server'
import {
  getCompetition,
  addTradeEvent,
  addParticipantPosition,
  removeParticipantPosition,
  updateParticipantPnl,
  STARTING_BALANCE,
} from '@/lib/store'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { competitionId, userId, symbol, side, amount, leverage, action, clientOrderId, currentPrice } = body

  if (!competitionId || !userId || !symbol || !side || !amount || !action) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const comp = getCompetition(competitionId)
  if (!comp) return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
  if (comp.status === 'ended') return NextResponse.json({ error: 'Competition ended' }, { status: 400 })

  const participant = comp.participants[userId]
  if (!participant) return NextResponse.json({ error: 'Not a participant' }, { status: 403 })

  const price = currentPrice ?? 0
  let pnl: number | undefined

  if (action === 'open') {
    // Check virtual balance (simplified)
    const usedMargin = participant.positions.reduce((sum, p) => {
      return sum + (p.entryPrice * p.amount) / p.leverage
    }, 0)
    const requiredMargin = (price * amount) / leverage
    const available = STARTING_BALANCE + participant.realizedPnl - usedMargin

    if (requiredMargin > available) {
      return NextResponse.json({ error: 'Insufficient virtual balance' }, { status: 400 })
    }

    const orderId = clientOrderId ?? randomUUID()
    addParticipantPosition(competitionId, userId, {
      symbol,
      side,
      entryPrice: price,
      amount,
      leverage,
      openedAt: Date.now(),
      clientOrderId: orderId,
    })

    addTradeEvent(competitionId, {
      id: randomUUID(),
      competitionId,
      userId,
      displayName: participant.displayName,
      symbol,
      side,
      amount,
      price,
      leverage,
      action: 'open',
      timestamp: Date.now(),
    })

    return NextResponse.json({ success: true, clientOrderId: orderId })
  }

  if (action === 'close') {
    const position = removeParticipantPosition(competitionId, userId, clientOrderId)
    if (!position) return NextResponse.json({ error: 'Position not found' }, { status: 404 })

    const priceDiff = position.side === 'bid'
      ? price - position.entryPrice
      : position.entryPrice - price
    pnl = priceDiff * position.amount * position.leverage

    updateParticipantPnl(competitionId, userId, pnl)

    addTradeEvent(competitionId, {
      id: randomUUID(),
      competitionId,
      userId,
      displayName: participant.displayName,
      symbol: position.symbol,
      side: position.side,
      amount: position.amount,
      price,
      leverage: position.leverage,
      action: 'close',
      pnl,
      timestamp: Date.now(),
    })

    return NextResponse.json({ success: true, pnl })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
