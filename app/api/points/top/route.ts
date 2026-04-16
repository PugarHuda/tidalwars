import { NextResponse } from 'next/server'
import { getTopCaptains, captainFor } from '@/lib/points'

export const revalidate = 30 // 30s cache

export async function GET() {
  const top = await getTopCaptains(20)
  return NextResponse.json({
    captains: top.map(t => ({ ...t, captain: captainFor(t.totalPoints) })),
    updatedAt: Date.now(),
  })
}
