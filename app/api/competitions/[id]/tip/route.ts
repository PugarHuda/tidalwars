import { NextRequest, NextResponse } from 'next/server'
import { getCompetition } from '@/lib/store'
import { sendTip, getTips } from '@/lib/tips'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const state = await getTips(id)
  return NextResponse.json({
    totals: state.totals,
    events: state.events,
    updatedAt: Date.now(),
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { fromUserId, fromDisplayName, toUserId, toDisplayName, amount } = body ?? {}

  if (!fromUserId || !toUserId || !fromDisplayName || !toDisplayName || typeof amount !== 'number') {
    return NextResponse.json({ error: 'Missing fromUserId, toUserId, displayName(s), or amount' }, { status: 400 })
  }

  const comp = await getCompetition(id)
  if (!comp) return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
  if (comp.status === 'ended') return NextResponse.json({ error: 'Arena ended — tips closed' }, { status: 400 })
  // Recipient must be a participant (trader). Sender can be anyone with points.
  if (!comp.participants[toUserId]) {
    return NextResponse.json({ error: 'Recipient is not a participant in this arena' }, { status: 400 })
  }

  const result = await sendTip({
    competitionId: id, fromUserId, fromDisplayName, toUserId, toDisplayName, amount,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    event: result.event,
    newFromBalance: result.newFromBalance,
    newToTotal: result.newToTotal,
  })
}
