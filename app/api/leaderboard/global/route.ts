export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getAllCompetitions, getTradeEvents, STARTING_BALANCE } from '@/lib/store'

export async function GET() {
  const competitions = await getAllCompetitions()

  const traderMap: Record<string, {
    userId: string
    displayName: string
    totalPnl: number
    competitions: number
    wins: number
    bestRoi: number
    totalRoi: number
    totalVolume: number
    totalTrades: number
  }> = {}

  let globalVolume = 0
  let globalTrades = 0

  for (const comp of competitions) {
    const events = await getTradeEvents(comp.id)
    const participants = Object.values(comp.participants)

    // Global volume & trade count
    for (const evt of events) {
      if (evt.action === 'open') {
        const notional = evt.price * evt.amount * evt.leverage
        globalVolume += notional
        globalTrades++
      }
    }

    if (participants.length === 0) continue

    const sorted = [...participants].sort((a, b) => b.realizedPnl - a.realizedPnl)

    sorted.forEach((p, idx) => {
      if (!traderMap[p.userId]) {
        traderMap[p.userId] = {
          userId: p.userId,
          displayName: p.displayName,
          totalPnl: 0,
          competitions: 0,
          wins: 0,
          bestRoi: -Infinity,
          totalRoi: 0,
          totalVolume: 0,
          totalTrades: 0,
        }
      }
      const t = traderMap[p.userId]
      const roi = (p.realizedPnl / STARTING_BALANCE) * 100
      t.totalPnl += p.realizedPnl
      t.totalRoi += roi
      t.competitions++
      if (idx === 0 && comp.status === 'ended') t.wins++
      if (roi > t.bestRoi) t.bestRoi = roi

      // Per-trader stats from events
      events
        .filter(e => e.userId === p.userId && e.action === 'open')
        .forEach(e => {
          t.totalVolume += e.price * e.amount * e.leverage
          t.totalTrades++
        })
    })
  }

  const leaderboard = Object.values(traderMap)
    .map(t => ({
      ...t,
      avgRoi: t.competitions > 0 ? t.totalRoi / t.competitions : 0,
      bestRoi: t.bestRoi === -Infinity ? 0 : t.bestRoi,
    }))
    .sort((a, b) => b.totalPnl - a.totalPnl)
    .map((e, i) => ({ ...e, rank: i + 1 }))

  const competitionSummaries = competitions.map(c => {
    const parts = Object.values(c.participants)
    const sorted = [...parts].sort((a, b) => b.realizedPnl - a.realizedPnl)
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      participantCount: parts.length,
      endsAt: c.endsAt,
      durationMinutes: c.durationMinutes,
      createdAt: c.createdAt,
      winner: c.status === 'ended' && sorted[0]
        ? { displayName: sorted[0].displayName, realizedPnl: sorted[0].realizedPnl }
        : null,
    }
  })

  return NextResponse.json({
    leaderboard,
    stats: {
      totalCompetitions: competitions.length,
      activeCompetitions: competitions.filter(c => c.status === 'active').length,
      totalTraders: leaderboard.length,
      globalVolume,
      globalTrades,
    },
    competitions: competitionSummaries,
  })
}
