/**
 * Browser-safe helpers for building the canonical Pacifica sign-message
 * (without any dependency on @solana/web3.js — just plain JSON + TextEncoder).
 *
 * The server-side lib/pacifica.ts already has buildSignedBody, but that pulls
 * in `@solana/web3.js` (Node-only) via the Keypair type. This lib can be
 * imported from client components without blowing up the client bundle.
 */

export function sortJsonKeys(value: unknown): unknown {
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

export interface CanonicalSignInput {
  type: string
  payload: Record<string, unknown>
  timestamp?: number
  expiryWindow?: number
}

export interface CanonicalSignOutput {
  canonical: { data: Record<string, unknown>; expiry_window: number; timestamp: number; type: string }
  bytesToSign: Uint8Array
  serialized: string
  timestamp: number
  expiryWindow: number
}

/**
 * Produces the exact byte sequence Pacifica expects to be Ed25519-signed.
 * Matches the Python SDK: {data, expiry_window, timestamp, type} with
 * recursively-sorted keys and compact JSON (separators=',' ':').
 */
export function buildCanonicalSignMessage(input: CanonicalSignInput): CanonicalSignOutput {
  const timestamp = input.timestamp ?? Date.now()
  const expiryWindow = input.expiryWindow ?? 5000
  const canonical = sortJsonKeys({
    data: input.payload,
    expiry_window: expiryWindow,
    timestamp,
    type: input.type,
  }) as CanonicalSignOutput['canonical']
  const serialized = JSON.stringify(canonical)
  const bytesToSign = new TextEncoder().encode(serialized)
  return { canonical, bytesToSign, serialized, timestamp, expiryWindow }
}

/**
 * After signing, assemble the final HTTP body Pacifica's /orders/create_market
 * expects. Accepts the already-computed signature + account.
 */
export function assemblePacificaBody(params: {
  account: string
  signature: string  // base58-encoded Ed25519 sig
  timestamp: number
  expiryWindow: number
  payload: Record<string, unknown>
  agentWallet?: string | null
}): Record<string, unknown> {
  return {
    account: params.account,
    ...(params.agentWallet ? { agent_wallet: params.agentWallet } : {}),
    signature: params.signature,
    timestamp: params.timestamp,
    expiry_window: params.expiryWindow,
    ...params.payload,
  }
}
