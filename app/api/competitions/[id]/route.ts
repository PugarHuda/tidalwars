import { NextRequest, NextResponse } from 'next/server'
import {
  getCompetition, joinCompetition, settleCompetition, STARTING_BALANCE,
  addTradeEvent, addParticipantPosition, removeParticipantPosition, updateParticipantPnl,
} from '@/lib/store'
import { placeMarketOrder, closePosition, getDemoKeypair } from '@/lib/pacifica'
import { trackTradeOpened, trackTradeClosed, trackCompetitionJoined, trackCompetitionWon } from '@/lib/fuul'
import { addPointsResult } from '@/lib/points'
import { randomUUID } from 'crypto'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const comp = await getCompetition(id)
  if (!comp) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(comp)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  // ── Settle ──────────────────────────────────────────────────────────────────
  if (body.action === 'settle') {
    const prices: Record<string, number> = body.prices ?? {}
    const comp = await getCompetition(id)
    if (!comp) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (comp.status !== 'ended' && Date.now() < comp.endsAt) {
      return NextResponse.json({ error: 'Competition still running' }, { status: 400 })
    }
    await settleCompetition(id, Object.keys(prices).length > 0 ? prices : undefined)
    const final = Object.values(comp.participants)
      .map(p => ({ userId: p.userId, displayName: p.displayName, totalPnl: p.realizedPnl, roi: (p.realizedPnl / 10000) * 100 }))
      .sort((a, b) => b.totalPnl - a.totalPnl)
      .map((e, i) => ({ ...e, rank: i + 1 }))

    // Award Tidal Points to every participant based on final rank + ROI
    const pointsAwards = await Promise.all(final.map(async entry => {
      const participant = comp.participants[entry.userId]
      const { earned, totals } = await addPointsResult({
        userId: entry.userId,
        displayName: entry.displayName,
        walletAddress: participant?.walletAddress,
        rank: entry.rank,
        totalParticipants: final.length,
        roi: entry.roi,
        pnl: entry.totalPnl,
      })
      return { userId: entry.userId, earned, totalPoints: totals.totalPoints }
    }))

    if (final.length > 0) {
      const winner = comp.participants[final[0].userId]
      trackCompetitionWon({ userId: final[0].userId, walletAddress: winner?.walletAddress, pnl: final[0].totalPnl })
    }
    return NextResponse.json({ settled: true, final, pointsAwards })
  }

  // ── Trade ────────────────────────────────────────────────────────────────────
  if (body.action === 'open' || body.action === 'close') {
    const { userId, displayName, symbol, side, amount, leverage, action, clientOrderId, currentPrice, mode } = body
    const isTestnetMode = mode === 'testnet'
    if (!userId || !symbol || !side || !amount || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const comp = await getCompetition(id)
    if (!comp) return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
    if (comp.status === 'ended') return NextResponse.json({ error: 'Competition ended' }, { status: 400 })
    const participant = comp.participants[userId]
    if (!participant) return NextResponse.json({ error: 'Not a participant' }, { status: 403 })

    const price = currentPrice ?? 0
    const orderId = clientOrderId ?? randomUUID()
    const demoKeypair = getDemoKeypair()
    let pacificaResult: { success: boolean; orderId?: string; error?: string } | null = null

    if (action === 'open') {
      const usedMargin = participant.positions.reduce((s, p) => s + (p.entryPrice * p.amount) / p.leverage, 0)
      const requiredMargin = (price * amount) / leverage
      const available = STARTING_BALANCE + participant.realizedPnl - usedMargin
      if (requiredMargin > available) {
        return NextResponse.json({ error: 'Insufficient virtual balance' }, { status: 400 })
      }
      await addParticipantPosition(id, userId, { symbol, side, entryPrice: price, amount, leverage, openedAt: Date.now(), clientOrderId: orderId })

      if (demoKeypair && isTestnetMode) {
        pacificaResult = await placeMarketOrder({
          keypair: demoKeypair, symbol, side, amount: String(amount), clientOrderId: orderId,
        }).catch(() => ({ success: false, error: 'Network error' }))
      }

      await addTradeEvent(id, {
        id: randomUUID(), competitionId: id, userId,
        displayName: displayName ?? participant.displayName,
        symbol, side, amount, price, leverage, action: 'open',
        pacificaOrderId: pacificaResult?.orderId,
        timestamp: Date.now(),
      })

      trackTradeOpened({
        userId, walletAddress: participant.walletAddress,
        symbol, notionalValue: price * amount * leverage, leverage,
      })

      return NextResponse.json({ success: true, clientOrderId: orderId, pacifica: pacificaResult })
    }

    if (action === 'close') {
      const position = await removeParticipantPosition(id, userId, clientOrderId)
      if (!position) return NextResponse.json({ error: 'Position not found' }, { status: 404 })
      const priceDiff = position.side === 'bid' ? price - position.entryPrice : position.entryPrice - price
      const pnl = priceDiff * position.amount * position.leverage
      await updateParticipantPnl(id, userId, pnl)

      if (demoKeypair && isTestnetMode) {
        pacificaResult = await closePosition({
          keypair: demoKeypair, symbol: position.symbol, side: position.side,
          amount: String(position.amount), clientOrderId: randomUUID(),
        }).catch(() => ({ success: false, error: 'Network error' }))
      }

      await addTradeEvent(id, {
        id: randomUUID(), competitionId: id, userId,
        displayName: displayName ?? participant.displayName,
        symbol: position.symbol, side: position.side,
        amount: position.amount, price, leverage: position.leverage,
        action: 'close', pnl,
        pacificaOrderId: pacificaResult?.orderId,
        timestamp: Date.now(),
      })

      trackTradeClosed({ userId, walletAddress: participant.walletAddress, pnl, symbol: position.symbol })

      return NextResponse.json({ success: true, pnl, pacifica: pacificaResult })
    }
  }

  // ── Join ─────────────────────────────────────────────────────────────────────
  const { userId, displayName, walletAddress } = body
  if (!userId || !displayName) {
    return NextResponse.json({ error: 'Missing userId or displayName' }, { status: 400 })
  }
  const comp = await getCompetition(id)
  if (!comp) return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
  if (comp.status === 'ended') return NextResponse.json({ error: 'Competition ended' }, { status: 400 })
  const joined = await joinCompetition(id, {
    userId, displayName, walletAddress: walletAddress ?? '',
    positions: [], realizedPnl: 0, joinedAt: Date.now(),
  })
  if (!joined) return NextResponse.json({ error: 'Could not join' }, { status: 400 })
  trackCompetitionJoined({ userId, walletAddress: walletAddress ?? '' })
  return NextResponse.json({ success: true, startingBalance: STARTING_BALANCE })
}
