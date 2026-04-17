import { NextRequest, NextResponse } from 'next/server'
import { getTopMentions, isElfaEnabled } from '@/lib/elfa'

export const revalidate = 180 // 3-min server cache

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker') ?? 'BTC'
  const timeWindow = (req.nextUrl.searchParams.get('timeWindow') as '1h' | '4h' | '24h' | '7d') ?? '1h'

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
