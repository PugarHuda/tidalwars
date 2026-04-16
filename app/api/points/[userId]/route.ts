import { NextRequest, NextResponse } from 'next/server'
import { getPoints, captainFor, CAPTAIN_TIERS } from '@/lib/points'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const record = await getPoints(userId)
  if (!record) {
    return NextResponse.json({
      userId, exists: false,
      totalPoints: 0, wins: 0, runnerUps: 0, arenasEntered: 0,
      bestRoi: 0, totalPnl: 0,
      captain: captainFor(0),
      tiers: CAPTAIN_TIERS,
    })
  }
  return NextResponse.json({
    ...record,
    exists: true,
    captain: captainFor(record.totalPoints),
    tiers: CAPTAIN_TIERS,
  })
}
