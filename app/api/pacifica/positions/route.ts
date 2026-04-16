import { NextRequest, NextResponse } from 'next/server'

const REST_URL = process.env.NEXT_PUBLIC_PACIFICA_REST_URL ?? 'https://test-api.pacifica.fi/api/v1'

export interface PacificaPosition {
  symbol: string
  side: 'long' | 'short'
  size: number
  entryPrice: number
  markPrice: number
  unrealizedPnl: number
  leverage: number
  margin: number
  liquidationPrice: number
  roe: number
}

function normalizePosition(p: Record<string, unknown>): PacificaPosition {
  const f = (...keys: string[]) => keys.reduce<number>((v, k) => v || +String(p[k] ?? 0) || 0, 0)
  return {
    symbol:          String(p.symbol ?? p.market ?? ''),
    side:            String(p.side ?? p.direction ?? 'long') === 'short' ? 'short' : 'long',
    size:            f('size', 'amount', 'qty'),
    entryPrice:      f('entry_price', 'entryPrice', 'avg_entry_price'),
    markPrice:       f('mark_price', 'markPrice'),
    unrealizedPnl:   f('unrealized_pnl', 'unrealizedPnl', 'upnl'),
    leverage:        f('leverage') || 1,
    margin:          f('margin', 'initial_margin'),
    liquidationPrice: f('liquidation_price', 'liqPrice'),
    roe:             f('roe', 'return_on_equity'),
  }
}

export async function GET(req: NextRequest) {
  // Accept both ?wallet= and ?account= for flexibility
  const wallet = req.nextUrl.searchParams.get('wallet') ?? req.nextUrl.searchParams.get('account')
  if (!wallet) return NextResponse.json({ positions: [], note: 'wallet or account param required' })

  try {
    // Try different Pacifica position endpoints
    const endpoints = [
      `${REST_URL}/positions?account=${wallet}`,
      `${REST_URL}/account/positions?account=${wallet}`,
      `${REST_URL}/position?account=${wallet}`,
    ]

    for (const url of endpoints) {
      const res = await fetch(url, { next: { revalidate: 5 } })
      if (res.ok) {
        const raw = await res.json()
        const positions: PacificaPosition[] = Array.isArray(raw)
          ? raw.map(normalizePosition).filter(p => p.symbol && p.size > 0)
          : Array.isArray(raw?.positions)
            ? raw.positions.map(normalizePosition).filter((p: PacificaPosition) => p.symbol && p.size > 0)
            : []
        return NextResponse.json({ positions, source: url })
      }
    }

    // Also try to get from account info
    const accountRes = await fetch(`${REST_URL}/account?account=${wallet}`, { next: { revalidate: 5 } })
    if (accountRes.ok) {
      const account = await accountRes.json()
      const positions = Array.isArray(account?.positions)
        ? account.positions.map(normalizePosition).filter((p: PacificaPosition) => p.symbol && p.size > 0)
        : []
      return NextResponse.json({ positions, account: account ?? null })
    }

    return NextResponse.json({ positions: [], note: 'No positions endpoint available' })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
