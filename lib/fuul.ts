/**
 * Fuul Integration — Off-chain event tracking for competition rewards
 * Docs: https://docs.fuul.xyz/developer-guide/sending-custom-events-through-the-api
 *
 * Events tracked:
 * - trade_opened: when a user opens a position
 * - trade_closed: when a user closes a position
 * - competition_won: when a user wins a competition
 * - competition_joined: when a user joins a competition
 */

const FUUL_API_URL = 'https://api.fuul.xyz/api/v1'

type IdentifierType = 'evm_address' | 'solana_address' | 'email'

interface FuulEvent {
  name: string
  user: { identifier: string; identifier_type: IdentifierType }
  args?: {
    value?: { amount: string; currency: { name: string } }
    revenue?: { amount: string; currency: { name: string } }
  }
}

/** Detect Solana vs EVM address vs fallback to email-style identifier */
function resolveIdentifier(userId: string, walletAddress?: string): { identifier: string; identifier_type: IdentifierType } {
  const addr = walletAddress || userId
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr) && !addr.startsWith('0x')) {
    return { identifier: addr, identifier_type: 'solana_address' }
  }
  if (/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    return { identifier: addr, identifier_type: 'evm_address' }
  }
  // Fallback: use userId as email-style identifier so Fuul can still track
  return { identifier: `${userId}@tidalwars`, identifier_type: 'email' }
}

/** Fire-and-forget event — never throws, never blocks trade execution */
async function sendEvent(event: FuulEvent): Promise<void> {
  const key = process.env.FUUL_API_KEY
  if (!key) return

  try {
    const res = await fetch(`${FUUL_API_URL}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify(event),
    })
    if (!res.ok) {
      // Silent fail — tracking is non-critical
      console.warn('[Fuul] event rejected:', res.status, await res.text().catch(() => ''))
    }
  } catch {
    // Network errors are silently ignored
  }
}

// USD amount in cents (integer string) for Fuul value tracking
function usdCents(dollars: number): string {
  return String(Math.max(0, Math.floor(Math.abs(dollars) * 100)))
}

// ── Public tracking functions ──────────────────────────────────────────────────

export function trackTradeOpened(params: {
  userId: string
  walletAddress?: string
  symbol: string
  notionalValue: number  // price × amount × leverage
  leverage: number
}): void {
  const user = resolveIdentifier(params.userId, params.walletAddress)
  sendEvent({
    name: 'trade_opened',
    user,
    args: {
      value: { amount: usdCents(params.notionalValue), currency: { name: 'USD' } },
    },
  })
}

export function trackTradeClosed(params: {
  userId: string
  walletAddress?: string
  pnl: number
  symbol: string
}): void {
  const user = resolveIdentifier(params.userId, params.walletAddress)
  sendEvent({
    name: 'trade_closed',
    user,
    args: {
      value: { amount: usdCents(Math.abs(params.pnl)), currency: { name: 'USD' } },
      revenue: { amount: usdCents(Math.max(0, params.pnl)), currency: { name: 'USD' } },
    },
  })
}

export function trackCompetitionJoined(params: {
  userId: string
  walletAddress?: string
}): void {
  const user = resolveIdentifier(params.userId, params.walletAddress)
  sendEvent({ name: 'competition_joined', user })
}

export function trackCompetitionWon(params: {
  userId: string
  walletAddress?: string
  pnl: number
}): void {
  const user = resolveIdentifier(params.userId, params.walletAddress)
  sendEvent({
    name: 'competition_won',
    user,
    args: {
      value: { amount: usdCents(params.pnl), currency: { name: 'USD' } },
    },
  })
}

export function isFuulEnabled(): boolean {
  return Boolean(process.env.FUUL_API_KEY)
}
