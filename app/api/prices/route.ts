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

interface PacificaPriceRow {
  symbol: string
  mark?: string
  mid?: string
  oracle?: string
}

export async function GET() {
  try {
    const res = await fetch('https://test-api.pacifica.fi/api/v1/info/prices', {
      next: { revalidate: 5 },
    })
    if (res.ok) {
      const json = await res.json()
      const rows: PacificaPriceRow[] = Array.isArray(json?.data) ? json.data : []
      const prices: Record<string, number> = {}
      for (const row of rows) {
        const price = parseFloat(row.mark ?? row.mid ?? row.oracle ?? '0')
        if (price > 0 && row.symbol) {
          prices[row.symbol] = price
          // Pacifica lists some memecoins with k-prefix (kBONK = 1000 BONK)
          // Mirror them under the base symbol for UI consistency
          if (row.symbol.startsWith('k') && row.symbol.length > 1) {
            prices[row.symbol.slice(1)] = price / 1000
          }
        }
      }
      if (Object.keys(prices).length > 0) {
        updateLastKnownPrices(prices)
        return NextResponse.json(prices)
      }
    }
  } catch { /* fall through */ }

  updateLastKnownPrices(FALLBACK_PRICES)
  return NextResponse.json(FALLBACK_PRICES)
}
