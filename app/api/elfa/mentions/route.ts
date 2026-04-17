import { NextRequest, NextResponse } from 'next/server'
import { getTopMentions, isElfaEnabled } from '@/lib/elfa'

export const revalidate = 180 // 3-min server cache

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker') ?? 'BTC'
  const timeWindow = (req.nextUrl.searchParams.get('timeWindow') as '1h' | '4h' | '24h' | '7d') ?? '1h'
  const debug = req.nextUrl.searchParams.get('debug') === '1'

  // If debug=1, also include raw Elfa response to discover real field names
  if (debug && process.env.ELFA_API_KEY) {
    const params = new URLSearchParams({ ticker, timeWindow, limit: '5', minEngagement: '10' })
    const res = await fetch(`https://api.elfa.ai/v2/data/top-mentions?${params}`, {
      headers: { 'x-elfa-api-key': process.env.ELFA_API_KEY },
    })
    const raw = await res.json().catch(() => ({}))
    return NextResponse.json({ ticker, timeWindow, _raw: raw })
  }

  const mentions = await getTopMentions(ticker, timeWindow, 5)

  return NextResponse.json({
    ticker,
    timeWindow,
    mentions,
    enabled: isElfaEnabled(),
    // Aggregate heat: average of top-5 heat scores, gives a "smart money" badge value
    avgHeat: mentions.length
      ? Math.round(mentions.reduce((s, m) => s + m.heat, 0) / mentions.length)
      : 0,
    totalEngagement: mentions.reduce((s, m) => s + m.viewCount + m.likeCount * 3, 0),
    updatedAt: Date.now(),
  })
}
