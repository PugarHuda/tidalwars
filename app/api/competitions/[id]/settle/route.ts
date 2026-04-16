import { NextRequest, NextResponse } from 'next/server'
import { getCompetition, settleCompetition } from '@/lib/store'

// Called by frontend when it detects time is up, or automatically by getCompetition
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const prices: Record<string, number> = body.prices ?? {}

  const comp = await getCompetition(id)
  if (!comp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (comp.status !== 'ended') {
    // Force settle early only if time has passed
    if (Date.now() < comp.endsAt) {
      return NextResponse.json({ error: 'Competition still running' }, { status: 400 })
    }
  }

  await settleCompetition(id, Object.keys(prices).length > 0 ? prices : undefined)

  // Return final leaderboard
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
