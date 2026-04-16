import { NextRequest, NextResponse } from 'next/server'

const REST_URL = process.env.NEXT_PUBLIC_PACIFICA_REST_URL ?? 'https://test-api.pacifica.fi/api/v1'

/**
 * Fetch real Pacifica account balance, margin, and builder-code approvals for a wallet.
 * Lets users see their actual testnet balance separately from the virtual $10k competition balance.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')
  if (!wallet) return NextResponse.json({ error: 'Missing ?wallet= param' }, { status: 400 })

  const [accountRes, approvalsRes] = await Promise.all([
    fetch(`${REST_URL}/account?account=${wallet}`, { next: { revalidate: 5 } })
      .then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(`${REST_URL}/account/builder_codes/approvals?account=${wallet}`, { next: { revalidate: 30 } })
      .then(r => r.ok ? r.json() : null).catch(() => null),
  ])

  // Normalise across possible response shapes
  const account = accountRes?.data ?? accountRes ?? null
  const approvals = Array.isArray(approvalsRes) ? approvalsRes
    : Array.isArray(approvalsRes?.data) ? approvalsRes.data
    : []

  return NextResponse.json({
    wallet,
    account,
    balance: account ? parseFloat(account.balance ?? account.available ?? '0') : null,
    equity: account ? parseFloat(account.equity ?? account.total_equity ?? '0') : null,
    marginUsed: account ? parseFloat(account.margin_used ?? account.used_margin ?? '0') : null,
    builderCodeApprovals: approvals,
    hasApprovedTidalwars: approvals.some((a: { builder_code?: string }) =>
      (a.builder_code ?? '').toUpperCase() === 'TIDALWARS'),
    faucet: 'https://test-app.pacifica.fi/',
    updatedAt: Date.now(),
  })
}
