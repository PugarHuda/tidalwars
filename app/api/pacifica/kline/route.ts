import { NextRequest, NextResponse } from 'next/server'

const REST_URL = process.env.NEXT_PUBLIC_PACIFICA_REST_URL ?? 'https://test-api.pacifica.fi/api/v1'

export interface Candle {
  t: number   // start ms
  T: number   // end ms
  o: number   // open
  c: number   // close
  h: number   // high
  l: number   // low
  v: number   // volume
  n: number   // trade count
}

/**
 * Real Pacifica OHLCV candles for the last N minutes.
 *   GET /api/pacifica/kline?symbol=BTC&interval=1m&limit=60
 */
export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol') ?? 'BTC'
  const interval = req.nextUrl.searchParams.get('interval') ?? '1m'
  const limit = Math.min(300, Number(req.nextUrl.searchParams.get('limit') ?? '60'))

  // Map interval to ms
  const IVL: Record<string, number> = {
    '1m': 60_000, '3m': 180_000, '5m': 300_000, '15m': 900_000, '30m': 1_800_000,
    '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
  }
  const ivl = IVL[interval] ?? 60_000
  const end = Date.now()
  const start = end - ivl * limit

  try {
    const url = `${REST_URL}/kline?symbol=${encodeURIComponent(symbol)}&interval=${interval}&start_time=${start}&end_time=${end}`
    const res = await fetch(url, { next: { revalidate: 10 } })
    if (!res.ok) return NextResponse.json({ candles: [], error: `Pacifica ${res.status}` })
    const json = await res.json()
    const rows = Array.isArray(json?.data) ? json.data : []
    const candles: Candle[] = rows.map((r: Record<string, unknown>) => ({
      t: Number(r.t ?? 0),
      T: Number(r.T ?? 0),
      o: Number(r.o ?? 0),
      c: Number(r.c ?? 0),
      h: Number(r.h ?? 0),
      l: Number(r.l ?? 0),
      v: Number(r.v ?? 0),
      n: Number(r.n ?? 0),
    })).filter((c: Candle) => c.t > 0)
    return NextResponse.json({ symbol, interval, candles, updatedAt: Date.now() })
  } catch (e) {
    return NextResponse.json({ candles: [], error: String(e) })
  }
}
