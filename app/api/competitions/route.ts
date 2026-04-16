import { NextRequest, NextResponse } from 'next/server'
import { createCompetition, getAllCompetitions } from '@/lib/store'

export async function GET() {
  const comps = getAllCompetitions()
  return NextResponse.json(comps)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, creatorId, durationMinutes, allowedSymbols, maxLeverage } = body

  if (!name || !creatorId || !durationMinutes) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const comp = createCompetition({ name, creatorId, durationMinutes, allowedSymbols, maxLeverage })
  return NextResponse.json(comp, { status: 201 })
}
