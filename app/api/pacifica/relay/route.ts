import { NextRequest, NextResponse } from 'next/server'

const REST_URL = (process.env.NEXT_PUBLIC_PACIFICA_REST_URL ?? 'https://test-api.pacifica.fi/api/v1').trim()

/**
 * Relay endpoint — client signs a Pacifica order with their Privy wallet,
 * we just forward the signed body to Pacifica. Server never signs.
 *
 * This is the "Option 1" path from the Privy docs: keep private keys in
 * the browser iframe/TEE, use our server purely as a CORS-safe proxy +
 * volume attribution hook.
 *
 * Request body:
 *   endpoint: 'orders/create_market' | 'account/builder_codes/approve' | ...
 *   body:     the assembled Pacifica request (account, signature, timestamp,
 *             expiry_window, ...payload fields)
 */
export async function POST(req: NextRequest) {
  try {
    const { endpoint, body } = await req.json()

    if (typeof endpoint !== 'string' || !body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Bad request: need {endpoint, body}' }, { status: 400 })
    }

    // Whitelist acceptable Pacifica paths — we don't want to be an open proxy
    const ALLOWED: Set<string> = new Set([
      'orders/create_market',
      'orders/create',
      'orders/stop/create',
      'positions/tpsl',
      'account/builder_codes/approve',
      'account/builder_codes/revoke',
      'agent/bind',
    ])
    if (!ALLOWED.has(endpoint)) {
      return NextResponse.json({ error: `Endpoint not allowed: ${endpoint}` }, { status: 400 })
    }

    const res = await fetch(`${REST_URL}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json().catch(() => ({}))
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      pacifica: data,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
