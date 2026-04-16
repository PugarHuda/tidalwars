import { NextResponse } from 'next/server'

const REST_URL = process.env.NEXT_PUBLIC_PACIFICA_REST_URL ?? 'https://test-api.pacifica.fi/api/v1'

export interface PacificaMarket {
  symbol: string
  markPrice: number
  lastPrice: number
  indexPrice: number
  fundingRate: number
  nextFundingTime: number
  change24h: number
  openInterest: number
  volume24h: number
  minSize: number
  maxLeverage: number
  status: string
}

function normalizeMarket(m: Record<string, unknown>): PacificaMarket {
  const f = (...keys: string[]) => keys.reduce<number>((v, k) => v || +String(m[k] ?? 0) || 0, 0)
  return {
    symbol:          String(m.symbol ?? ''),
    markPrice:       f('mark_price', 'markPrice', 'price'),
    lastPrice:       f('last_price', 'lastPrice'),
    indexPrice:      f('index_price', 'indexPrice'),
    fundingRate:     f('funding_rate', 'fundingRate'),
    nextFundingTime: +String(m.next_funding_time ?? m.nextFundingTime ?? 0) || 0,
    change24h:       f('change_24h', 'priceChangePercent', 'price_change_24h'),
    openInterest:    f('open_interest', 'openInterest'),
    volume24h:       f('volume_24h', 'volume', 'quoteVolume'),
    minSize:         f('min_size', 'minSize', 'stepSize') || 0.001,
    maxLeverage:     f('max_leverage', 'maxLeverage') || 20,
    status:          String(m.status ?? 'active'),
  }
}

export async function GET() {
  try {
    // Pacifica testnet: /info returns instrument metadata (funding rates, leverage limits)
    const res = await fetch(`${REST_URL}/info`, {
      next: { revalidate: 10 },
    })
    if (!res.ok) {
      return NextResponse.json({ error: `Pacifica returned ${res.status}` }, { status: 502 })
    }
    const json = await res.json()
    // Response: {success: true, data: [...instruments]}
    const raw: unknown[] = json?.data ?? (Array.isArray(json) ? json : [])
    const markets: PacificaMarket[] = raw
      .map(normalizeMarket as (m: unknown) => PacificaMarket)
      .filter(m => m.symbol)
    return NextResponse.json(markets)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
