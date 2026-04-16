import { NextRequest, NextResponse } from 'next/server'
import { getTrendingTokens, isElfaEnabled } from '@/lib/elfa'

export const revalidate = 300 // 5-minute server cache

export async function GET(req: NextRequest) {
  const timeWindow = (req.nextUrl.searchParams.get('timeWindow') as '1h' | '4h' | '24h') ?? '4h'
  const tokens = await getTrendingTokens(timeWindow, 10)

  return NextResponse.json({
    tokens,
    enabled: isElfaEnabled(),
    timeWindow,
    source: 'Elfa AI',
    updatedAt: Date.now(),
  })
}
