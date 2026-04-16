import { Keypair } from '@solana/web3.js'
import nacl from 'tweetnacl'
import bs58 from 'bs58'

const REST_URL = process.env.NEXT_PUBLIC_PACIFICA_REST_URL || 'https://test-api.pacifica.fi/api/v1'
const WS_URL = process.env.NEXT_PUBLIC_PACIFICA_WS_URL || 'wss://test-ws.pacifica.fi/ws'

export { WS_URL }

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

function prepareMessage(header: object, payload: object): string {
  const data = sortJsonKeys({ ...header, data: payload })
  return JSON.stringify(data)
}

function signMessage(header: object, payload: object, secretKey: Uint8Array) {
  const message = prepareMessage(header, payload)
  const messageBytes = new TextEncoder().encode(message)
  // Use only first 32 bytes as seed for nacl (nacl expects 64-byte key or 32-byte seed)
  const signature = nacl.sign.detached(messageBytes, secretKey)
  return { message, signature: bs58.encode(signature) }
}

export function keypairFromBase58(privateKey: string): Keypair {
  return Keypair.fromSecretKey(bs58.decode(privateKey))
}

export async function placeMarketOrder(params: {
  keypair: Keypair
  symbol: string
  side: 'bid' | 'ask'
  amount: string
  reduceOnly?: boolean
  slippagePercent?: string
  clientOrderId: string
}) {
  const timestamp = Date.now()
  const header = {
    timestamp,
    expiry_window: 5000,
    type: 'create_market_order',
  }
  const payload = {
    symbol: params.symbol,
    reduce_only: params.reduceOnly ?? false,
    amount: params.amount,
    side: params.side,
    slippage_percent: params.slippagePercent ?? '0.5',
    client_order_id: params.clientOrderId,
  }

  const { signature } = signMessage(header, payload, params.keypair.secretKey)

  const body = {
    account: params.keypair.publicKey.toBase58(),
    signature,
    timestamp,
    expiry_window: 5000,
    ...payload,
  }

  const res = await fetch(`${REST_URL}/orders/create_market`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return res.json()
}

export async function getMarketPrices(): Promise<Record<string, number>> {
  try {
    const res = await fetch(`${REST_URL}/markets`, {
      next: { revalidate: 5 },
    })
    if (!res.ok) return {}
    const data = await res.json()
    const prices: Record<string, number> = {}
    if (Array.isArray(data)) {
      data.forEach((market: { symbol: string; mark_price?: string; last_price?: string }) => {
        prices[market.symbol] = parseFloat(market.mark_price ?? market.last_price ?? '0')
      })
    }
    return prices
  } catch {
    return {}
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
