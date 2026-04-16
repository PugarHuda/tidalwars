import { NextResponse } from 'next/server'
import { updateLastKnownPrices } from '@/lib/store'

// Fallback prices if Pacifica API is unreachable
const FALLBACK_PRICES: Record<string, number> = {
  BTC: 84000,
  ETH: 3200,
  SOL: 145,
  WIF: 2.1,
  BONK: 0.000025,
}

export async function GET() {
  try {
    const res = await fetch('https://test-api.pacifica.fi/api/v1/markets', {
      next: { revalidate: 10 },
    })

    if (res.ok) {
      const data = await res.json()
      const prices: Record<string, number> = {}
      if (Array.isArray(data)) {
        data.forEach((m: { symbol: string; mark_price?: string; last_price?: string }) => {
          const price = parseFloat(m.mark_price ?? m.last_price ?? '0')
          if (price > 0) prices[m.symbol] = price
        })
      }
      if (Object.keys(prices).length > 0) {
        updateLastKnownPrices(prices)
        return NextResponse.json(prices)
      }
    }
  } catch {
    // fall through to fallback
  }

  updateLastKnownPrices(FALLBACK_PRICES)
  return NextResponse.json(FALLBACK_PRICES)
}
