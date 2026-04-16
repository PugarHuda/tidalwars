import { NextRequest, NextResponse } from 'next/server'
import { getTradeEvents } from '@/lib/store'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const events = await getTradeEvents(id)
  return NextResponse.json(events)
}
