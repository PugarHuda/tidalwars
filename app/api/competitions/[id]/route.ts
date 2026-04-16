import { NextRequest, NextResponse } from 'next/server'
import { getCompetition, joinCompetition, settleCompetition, STARTING_BALANCE } from '@/lib/store'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const comp = getCompetition(id)
  if (!comp) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(comp)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  // Handle settle action (merged here to share in-memory store instance)
  if (body.action === 'settle') {
    const prices: Record<string, number> = body.prices ?? {}
    const comp = getCompetition(id)
    if (!comp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (comp.status !== 'ended' && Date.now() < comp.endsAt) {
      return NextResponse.json({ error: 'Competition still running' }, { status: 400 })
    }

    settleCompetition(id, Object.keys(prices).length > 0 ? prices : undefined)

    const participants = Object.values(comp.participants)
    const final = participants
      .map(p => ({
        userId: p.userId,
        displayName: p.displayName,
        totalPnl: p.realizedPnl,
        roi: (p.realizedPnl / 10000) * 100,
      }))
      .sort((a, b) => b.totalPnl - a.totalPnl)
      .map((e, i) => ({ ...e, rank: i + 1 }))

    return NextResponse.json({ settled: true, final })
  }

  // Handle join
  const { userId, displayName, walletAddress } = body
  if (!userId || !displayName) {
    return NextResponse.json({ error: 'Missing userId or displayName' }, { status: 400 })
  }

  const comp = getCompetition(id)
  if (!comp) return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
  if (comp.status === 'ended') return NextResponse.json({ error: 'Competition ended' }, { status: 400 })

  const joined = joinCompetition(id, {
    userId,
    displayName,
    walletAddress: walletAddress ?? '',
    positions: [],
    realizedPnl: 0,
    joinedAt: Date.now(),
  })

  if (!joined) return NextResponse.json({ error: 'Could not join' }, { status: 400 })

  return NextResponse.json({ success: true, startingBalance: STARTING_BALANCE })
}
