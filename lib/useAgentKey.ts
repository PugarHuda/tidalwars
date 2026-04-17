'use client'
import { useCallback, useState } from 'react'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { buildCanonicalSignMessage, assemblePacificaBody } from './pacifica-canonical'
import type { SignedPacificaRequest, UsePrivySolanaSign } from './usePrivySolanaSign'

/**
 * Ed25519 keypair held ONLY in React state — never persisted, never exposed.
 * When user tabs away or refreshes, the key is gone and must be re-bound.
 */
interface AgentKey {
  publicKey: string        // bs58 Solana pubkey
  secretKey: Uint8Array    // 64 bytes (nacl format)
  mainAccount: string      // The user's main Solana pubkey that bound this agent
  boundAt: number
}

export interface UseAgentKey {
  agent: AgentKey | null
  bound: boolean
  boundFor: string | null  // main account this agent was bound for
  /**
   * Generate a fresh ephemeral keypair and ask Privy to sign the bind
   * message. Returns once Pacifica confirms the bind.
   */
  bind: (privy: UsePrivySolanaSign) => Promise<{
    ok: boolean
    agentPubkey: string
    pacifica?: unknown
    error?: string
  }>
  /**
   * Sign an order with the agent keypair (no user prompt). Caller must
   * check `bound` first. Returns the assembled Pacifica HTTP body.
   */
  signOrder: (params: {
    type: string
    payload: Record<string, unknown>
  }) => SignedPacificaRequest & { assembledBody: Record<string, unknown> }
  unbind: () => void
}

function generateKeypair() {
  const kp = nacl.sign.keyPair()
  return {
    publicKey: bs58.encode(kp.publicKey),
    secretKey: kp.secretKey,
  }
}

export function useAgentKey(): UseAgentKey {
  const [agent, setAgent] = useState<AgentKey | null>(null)

  const bind = useCallback(async (privy: UsePrivySolanaSign) => {
    if (!privy.ready || !privy.walletAddress) {
      return { ok: false, agentPubkey: '', error: 'Privy wallet not connected' }
    }

    // 1) Generate ephemeral keypair (client-side, never transmitted raw)
    const ephemeral = generateKeypair()

    try {
      // 2) Ask Privy to sign the bind_agent_wallet message (user's main wallet
      //    authorizes this agent pubkey to act on their behalf)
      const signed = await privy.signPacifica({
        type: 'bind_agent_wallet',
        payload: { agent_wallet: ephemeral.publicKey },
      })

      // 3) Relay to Pacifica /agent/bind
      const body = assemblePacificaBody({
        account: signed.account,
        signature: signed.signature,
        timestamp: signed.timestamp,
        expiryWindow: signed.expiryWindow,
        payload: { agent_wallet: ephemeral.publicKey },
      })
      const res = await fetch('/api/pacifica/relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'agent/bind', body }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        return { ok: false, agentPubkey: ephemeral.publicKey, pacifica: data, error: 'Pacifica rejected bind' }
      }

      // 4) Stash the keypair in React state. Only now, after Pacifica confirmed.
      setAgent({
        publicKey: ephemeral.publicKey,
        secretKey: ephemeral.secretKey,
        mainAccount: signed.account,
        boundAt: Date.now(),
      })
      return { ok: true, agentPubkey: ephemeral.publicKey, pacifica: data }
    } catch (e) {
      return { ok: false, agentPubkey: ephemeral.publicKey, error: e instanceof Error ? e.message : String(e) }
    }
  }, [])

  const signOrder = useCallback((params: { type: string; payload: Record<string, unknown> }) => {
    if (!agent) throw new Error('No agent key bound — call bind() first')

    const { canonical, bytesToSign, serialized, timestamp, expiryWindow } =
      buildCanonicalSignMessage({ type: params.type, payload: params.payload })

    // Sign canonical bytes with agent's secret key (no user prompt)
    const sigBytes = nacl.sign.detached(bytesToSign, agent.secretKey)
    const signature = bs58.encode(sigBytes)

    // Pacifica order body: account = MAIN wallet, signature = AGENT sig,
    // agent_wallet field at top level tells Pacifica which agent signed
    const assembledBody = assemblePacificaBody({
      account: agent.mainAccount,
      signature,
      timestamp,
      expiryWindow,
      payload: params.payload,
      agentWallet: agent.publicKey,
    })

    return {
      account: agent.mainAccount,
      signature,
      timestamp,
      expiryWindow,
      canonical: canonical as object,
      serialized,
      assembledBody,
    }
  }, [agent])

  const unbind = useCallback(() => setAgent(null), [])

  return {
    agent,
    bound: agent !== null,
    boundFor: agent?.mainAccount ?? null,
    bind,
    signOrder,
    unbind,
  }
}
