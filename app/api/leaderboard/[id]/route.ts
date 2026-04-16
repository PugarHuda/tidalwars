import { NextRequest, NextResponse } from 'next/server'
import { getCompetition } from '@/lib/store'
import { LeaderboardEntry } from '@/lib/types'

// Prices passed as query params for simplicity (client sends current prices)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const comp = await getCompetition(id)
  if (!comp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const pricesParam = req.nextUrl.searchParams.get('prices')
  const prices: Record<string, number> = pricesParam ? JSON.parse(pricesParam) : {}

  const entries: LeaderboardEntry[] = Object.values(comp.participants).map((p, idx) => {
    const unrealizedPnl = p.positions.reduce((sum, pos) => {
      const currentPrice = prices[pos.symbol] ?? pos.entryPrice
      const priceDiff = pos.side === 'bid'
        ? currentPrice - pos.entryPrice
        : pos.entryPrice - currentPrice
      return sum + priceDiff * pos.amount * pos.leverage
    }, 0)

    const totalPnl = unrealizedPnl + p.realizedPnl
    const roi = (totalPnl / 10000) * 100

    return {
      userId: p.userId,
      displayName: p.displayName,
      walletAddress: p.walletAddress,
      unrealizedPnl,
      realizedPnl: p.realizedPnl,
      totalPnl,
      roi,
      positionCount: p.positions.length,
      rank: idx + 1,
    }
  })

  // Sort by totalPnl desc, assign ranks
  entries.sort((a, b) => b.totalPnl - a.totalPnl)
  entries.forEach((e, i) => { e.rank = i + 1 })

  return NextResponse.json({ entries, updatedAt: Date.now() })
}
