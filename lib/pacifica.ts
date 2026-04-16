import { Keypair } from '@solana/web3.js'
import nacl from 'tweetnacl'
import bs58 from 'bs58'

const REST_URL = process.env.NEXT_PUBLIC_PACIFICA_REST_URL || 'https://test-api.pacifica.fi/api/v1'
export const WS_URL = process.env.NEXT_PUBLIC_PACIFICA_WS_URL || 'wss://test-ws.pacifica.fi/ws'

// Builder code earns protocol revenue — add to every order
const BUILDER_CODE = process.env.PACIFICA_BUILDER_CODE ?? ''

// --- Signing ---

function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonKeys)
  if (value !== null && typeof value === 'object') {
    return Object.keys(value as object)
      .sort()
      .reduce((acc, key) => {
        (acc as Record<string, unknown>)[key] = sortJsonKeys((value as Record<string, unknown>)[key])
        return acc
      }, {} as Record<string, unknown>)
  }
  return value
}

function buildSignedBody(type: string, payload: Record<string, unknown>, keypair: Keypair) {
  const timestamp = Date.now()
  const expiry_window = 5000

  // Message to sign: {data: payload, expiry_window, timestamp, type} — keys sorted
  const toSign = sortJsonKeys({ data: payload, expiry_window, timestamp, type })
  const messageBytes = new TextEncoder().encode(JSON.stringify(toSign))
  const sigBytes = nacl.sign.detached(messageBytes, keypair.secretKey)
  const signature = bs58.encode(sigBytes)

  return {
    account: keypair.publicKey.toBase58(),
    signature,
    timestamp,
    expiry_window,
    ...payload,
  }
}

export function keypairFromBase58(privateKey: string): Keypair {
  return Keypair.fromSecretKey(bs58.decode(privateKey))
}

// --- Demo keypair (server-side only) ---

let _demoKeypair: Keypair | null = null
export function getDemoKeypair(): Keypair | null {
  if (_demoKeypair) return _demoKeypair
  const pk = process.env.PACIFICA_DEMO_PRIVATE_KEY
  if (!pk) return null
  try {
    _demoKeypair = keypairFromBase58(pk)
    return _demoKeypair
  } catch {
    return null
  }
}

// --- API calls ---

export async function placeMarketOrder(params: {
  keypair: Keypair
  symbol: string
  side: 'bid' | 'ask'
  amount: string
  reduceOnly?: boolean
  slippagePercent?: string
  clientOrderId: string
}): Promise<{ success: boolean; orderId?: string; error?: string; raw?: unknown }> {
  try {
    const payload: Record<string, unknown> = {
      symbol: params.symbol,
      side: params.side,
      amount: params.amount,
      reduce_only: params.reduceOnly ?? false,
      slippage_percent: params.slippagePercent ?? '1',
      client_order_id: params.clientOrderId,
      // builder_code added after approval via /account/builder_code endpoint
      ...(BUILDER_CODE ? { builder_code: BUILDER_CODE } : {}),
    }

    const body = buildSignedBody('create_market_order', payload, params.keypair)

    const res = await fetch(`${REST_URL}/orders/create_market`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    if (!res.ok) return { success: false, error: data?.message ?? JSON.stringify(data), raw: data }
    return { success: true, orderId: data?.order_id ?? data?.id, raw: data }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export async function closePosition(params: {
  keypair: Keypair
  symbol: string
  side: 'bid' | 'ask'  // original side — close sends opposite
  amount: string
  clientOrderId: string
}): Promise<{ success: boolean; orderId?: string; error?: string; raw?: unknown }> {
  // Close by sending opposite market order with reduce_only
  const closeSide = params.side === 'bid' ? 'ask' : 'bid'
  return placeMarketOrder({
    keypair: params.keypair,
    symbol: params.symbol,
    side: closeSide,
    amount: params.amount,
    reduceOnly: true,
    clientOrderId: params.clientOrderId,
  })
}

export async function getMarketPrices(): Promise<Record<string, number>> {
  // Pacifica testnet exposes prices via WebSocket only; /info has instrument metadata
  // Return empty — caller falls back to cached/default prices
  return {}
}

export async function getInstruments(): Promise<{
  symbol: string; fundingRate: number; nextFundingRate: number
  maxLeverage: number; instrumentType: string; lotSize: number; tickSize: number
}[]> {
  try {
    const res = await fetch(`${REST_URL}/info`, { next: { revalidate: 30 } })
    if (!res.ok) return []
    const json = await res.json()
    const raw: Record<string, unknown>[] = json?.data ?? (Array.isArray(json) ? json : [])
    return raw.map(m => ({
      symbol: String(m.symbol ?? ''),
      fundingRate: +String(m.funding_rate ?? 0) || 0,
      nextFundingRate: +String(m.next_funding_rate ?? 0) || 0,
      maxLeverage: +String(m.max_leverage ?? 0) || 20,
      instrumentType: String(m.instrument_type ?? 'perpetual'),
      lotSize: +String(m.lot_size ?? 0) || 0.001,
      tickSize: +String(m.tick_size ?? 0) || 0.01,
    })).filter(m => m.symbol)
  } catch {
    return []
  }
}

export async function approveBuilderCode(keypair: Keypair, builderCode: string): Promise<{ success: boolean; raw?: unknown }> {
  try {
    const payload = { builder_code: builderCode }
    const body = buildSignedBody('approve_builder_code', payload, keypair)
    const res = await fetch(`${REST_URL}/account/builder_code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return { success: res.ok, raw: data }
  } catch (e) {
    return { success: false, raw: String(e) }
  }
}

export async function getAccountInfo(publicKey: string) {
  try {
    const res = await fetch(`${REST_URL}/account?account=${publicKey}`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function getPositions(publicKey: string): Promise<unknown[]> {
  const endpoints = [
    `${REST_URL}/positions?account=${publicKey}`,
    `${REST_URL}/account/positions?account=${publicKey}`,
    `${REST_URL}/position?account=${publicKey}`,
  ]
  for (const url of endpoints) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const data = await res.json()
      if (Array.isArray(data)) return data
      if (Array.isArray(data?.positions)) return data.positions
    } catch { /* try next */ }
  }
  return []
}

export async function getOrderHistory(publicKey: string, limit = 50): Promise<unknown[]> {
  const endpoints = [
    `${REST_URL}/orders?account=${publicKey}&limit=${limit}&status=filled`,
    `${REST_URL}/order_history?account=${publicKey}&limit=${limit}`,
    `${REST_URL}/fills?account=${publicKey}&limit=${limit}`,
  ]
  for (const url of endpoints) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const data = await res.json()
      if (Array.isArray(data)) return data
      if (Array.isArray(data?.orders)) return data.orders
      if (Array.isArray(data?.fills)) return data.fills
    } catch { /* try next */ }
  }
  return []
}

export interface FullMarketData {
  symbol: string
  markPrice: number
  lastPrice: number
  indexPrice: number
  fundingRate: number
  nextFundingTime: number
  change24h: number
  openInterest: number
  volume24h: number
  maxLeverage: number
}

export async function getFullMarketData(): Promise<FullMarketData[]> {
  try {
    // Pacifica testnet: use /info for instrument metadata + funding rates
    const res = await fetch(`${REST_URL}/info`, { next: { revalidate: 10 } })
    if (!res.ok) return []
    const json = await res.json()
    const raw: Record<string, unknown>[] = json?.data ?? (Array.isArray(json) ? json : [])
    const f = (m: Record<string, unknown>, ...keys: string[]) =>
      keys.reduce<number>((v, k) => v || +String(m[k] ?? 0) || 0, 0)
    return raw.map((m): FullMarketData => ({
      symbol:          String(m.symbol ?? ''),
      markPrice:       0, // only available via WS
      lastPrice:       0,
      indexPrice:      0,
      fundingRate:     f(m, 'funding_rate', 'fundingRate'),
      nextFundingTime: f(m, 'next_funding_rate', 'nextFundingTime'),
      change24h:       0,
      openInterest:    0,
      volume24h:       0,
      maxLeverage:     f(m, 'max_leverage') || 20,
    })).filter(m => m.symbol)
  } catch {
    return []
  }
}
