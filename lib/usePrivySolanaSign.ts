'use client'
import bs58 from 'bs58'
import { useCallback } from 'react'
import { useSignMessage, useWallets } from '@privy-io/react-auth/solana'
import { buildCanonicalSignMessage } from './pacifica-canonical'
import type { CanonicalSignInput } from './pacifica-canonical'

export interface SignedPacificaRequest {
  account: string              // Signer's Solana pubkey (base58)
  signature: string             // Ed25519 sig (base58)
  timestamp: number
  expiryWindow: number
  canonical: object             // The exact object that was serialized + signed
  serialized: string            // The exact string bytes that were signed
}

export interface UsePrivySolanaSign {
  ready: boolean
  walletAddress: string | null
  signPacifica: (input: CanonicalSignInput) => Promise<SignedPacificaRequest>
}

/**
 * Hook that exposes a `signPacifica(input)` method — given a Pacifica
 * signing payload (e.g. {type: 'create_market_order', payload: {...}}),
 * it builds the canonical message, pops Privy's sign modal, and returns
 * the base58 signature + account to POST to our API.
 *
 * Returns ready=false if user hasn't connected a Privy wallet yet.
 */
export function usePrivySolanaSign(): UsePrivySolanaSign {
  const { wallets } = useWallets()
  const { signMessage } = useSignMessage()

  // useWallets() from @privy-io/react-auth/solana already returns only Solana wallets
  // (type ConnectedStandardSolanaWallet). Just take the first one.
  const solanaWallet = wallets[0]

  const ready = Boolean(solanaWallet)
  const walletAddress = solanaWallet?.address ?? null

  const signPacifica = useCallback(async (input: CanonicalSignInput): Promise<SignedPacificaRequest> => {
    if (!solanaWallet) throw new Error('No Privy Solana wallet connected')

    const { canonical, bytesToSign, serialized, timestamp, expiryWindow } =
      buildCanonicalSignMessage(input)

    // Privy pops a sign-confirmation modal (unless caller suppresses via uiOptions)
    const result = await signMessage({
      message: bytesToSign,
      wallet: solanaWallet,
    })

    // Privy returns Uint8Array; Pacifica expects base58
    const signature = bs58.encode(result.signature)

    return {
      account: solanaWallet.address,
      signature,
      timestamp,
      expiryWindow,
      canonical: canonical as object,
      serialized,
    }
  }, [solanaWallet, signMessage])

  return { ready, walletAddress, signPacifica }
}
