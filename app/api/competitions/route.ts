import { NextRequest, NextResponse } from 'next/server'
import { createCompetition, getAllCompetitions } from '@/lib/store'

export async function GET() {
  const comps = await getAllCompetitions()
  return NextResponse.json(comps)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, creatorId, durationMinutes, startDelaySeconds, allowedSymbols, maxLeverage } = body

  if (!name || !creatorId || !durationMinutes) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const comp = await createCompetition({
    name, creatorId, durationMinutes,
    startDelaySeconds: Number(startDelaySeconds ?? 0),
    allowedSymbols, maxLeverage,
  })
  return NextResponse.json(comp, { status: 201 })
}
