import { NextRequest, NextResponse } from 'next/server'
import {
  getCompetition,
  addTradeEvent,
  addParticipantPosition,
  removeParticipantPosition,
  updateParticipantPnl,
  STARTING_BALANCE,
} from '@/lib/store'
import { placeMarketOrder, closePosition, getDemoKeypair } from '@/lib/pacifica'
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
  const orderId = clientOrderId ?? randomUUID()
  let pnl: number | undefined
  let pacificaResult: { success: boolean; orderId?: string; error?: string } | null = null

  // Get demo keypair for real Pacifica order execution
  const demoKeypair = getDemoKeypair()

  if (action === 'open') {
    // Check virtual balance
    const usedMargin = participant.positions.reduce((sum, p) => {
      return sum + (p.entryPrice * p.amount) / p.leverage
    }, 0)
    const requiredMargin = (price * amount) / leverage
    const available = STARTING_BALANCE + participant.realizedPnl - usedMargin

    if (requiredMargin > available) {
      return NextResponse.json({ error: 'Insufficient virtual balance' }, { status: 400 })
    }

    // Track virtual position
    addParticipantPosition(competitionId, userId, {
      symbol,
      side,
      entryPrice: price,
      amount,
      leverage,
      openedAt: Date.now(),
      clientOrderId: orderId,
    })

    // Fire real order to Pacifica testnet (non-blocking, best-effort)
    if (demoKeypair) {
      pacificaResult = await placeMarketOrder({
        keypair: demoKeypair,
        symbol,
        side,
        amount: String(amount),
        clientOrderId: orderId,
      }).catch(() => ({ success: false, error: 'Network error' }))
    }

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
      pacificaOrderId: pacificaResult?.orderId,
      timestamp: Date.now(),
    })

    return NextResponse.json({
      success: true,
      clientOrderId: orderId,
      pacifica: pacificaResult ?? { success: false, error: 'No keypair configured' },
    })
  }

  if (action === 'close') {
    const position = removeParticipantPosition(competitionId, userId, clientOrderId)
    if (!position) return NextResponse.json({ error: 'Position not found' }, { status: 404 })

    const priceDiff = position.side === 'bid'
      ? price - position.entryPrice
      : position.entryPrice - price
    pnl = priceDiff * position.amount * position.leverage

    updateParticipantPnl(competitionId, userId, pnl)

    // Close real position on Pacifica (best-effort)
    if (demoKeypair) {
      pacificaResult = await closePosition({
        keypair: demoKeypair,
        symbol: position.symbol,
        side: position.side,
        amount: String(position.amount),
        clientOrderId: randomUUID(),
      }).catch(() => ({ success: false, error: 'Network error' }))
    }

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
      pacificaOrderId: pacificaResult?.orderId,
      timestamp: Date.now(),
    })

    return NextResponse.json({
      success: true,
      pnl,
      pacifica: pacificaResult ?? { success: false, error: 'No keypair configured' },
    })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
