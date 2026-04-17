'use client'
import { useCallback, useState } from 'react'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { buildCanonicalSignMessage, assemblePacificaBody } from './pacifica-canonical'
import type { SignedPacificaRequest, UsePrivySolanaSign } from './usePrivySolanaSign'

/**
 * Ed25519 keypair held ONLY in React state — never persisted, never exposed.
 * When user tabs away or refreshes, the key is gone and must be re-bound.
 *
 * Bind modes:
 *   'pacifica' — registered with Pacifica /agent/bind. Real on-chain orders
 *                work without Privy modal per trade.
 *   'local'    — Pacifica rejected bind (account not whitelisted/deposited).
 *                Key still used for fast virtual trades + signature preview.
 *                Real on-chain orders will still fail.
 */
export type BindMode = 'pacifica' | 'local'

interface AgentKey {
  publicKey: string
  secretKey: Uint8Array
  mainAccount: string
  boundAt: number
  mode: BindMode
}

export interface UseAgentKey {
  agent: AgentKey | null
  bound: boolean
  mode: BindMode | null
  boundFor: string | null
  /**
   * Sign bind_agent_wallet via Privy, relay to Pacifica. If Pacifica rejects
   * (common for non-deposited accounts), fall back to 'local' mode which
   * still gives the no-modal-per-trade UX for virtual orders.
   */
  bind: (privy: UsePrivySolanaSign, opts?: { allowLocalFallback?: boolean }) => Promise<{
    ok: boolean
    mode: BindMode
    agentPubkey: string
    pacifica?: unknown
    error?: string
  }>
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

  const bind = useCallback(async (privy: UsePrivySolanaSign, opts?: { allowLocalFallback?: boolean }) => {
    if (!privy.ready || !privy.walletAddress) {
      return { ok: false, mode: 'local' as BindMode, agentPubkey: '', error: 'Privy wallet not connected' }
    }
    const allowFallback = opts?.allowLocalFallback !== false  // default true

    const ephemeral = generateKeypair()

    let mainAccount = privy.walletAddress
    let pacificaErr: unknown = null

    try {
      const signed = await privy.signPacifica({
        type: 'bind_agent_wallet',
        payload: { agent_wallet: ephemeral.publicKey },
      })
      mainAccount = signed.account

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

      if (res.ok && data.ok) {
        // ✅ Pacifica accepted
        setAgent({
          publicKey: ephemeral.publicKey, secretKey: ephemeral.secretKey,
          mainAccount, boundAt: Date.now(), mode: 'pacifica',
        })
        return { ok: true, mode: 'pacifica' as BindMode, agentPubkey: ephemeral.publicKey, pacifica: data }
      }

      // Pacifica rejected — fall back to local if allowed
      pacificaErr = data
    } catch (e) {
      pacificaErr = e instanceof Error ? e.message : String(e)
      // If Privy itself failed (user cancelled), don't fallback — bail
      if (String(pacificaErr).toLowerCase().includes('reject') ||
          String(pacificaErr).toLowerCase().includes('cancel')) {
        return { ok: false, mode: 'local' as BindMode, agentPubkey: ephemeral.publicKey, error: 'Sign request cancelled' }
      }
    }

    // Fallback to local session mode
    if (!allowFallback) {
      return { ok: false, mode: 'local' as BindMode, agentPubkey: ephemeral.publicKey,
        pacifica: pacificaErr, error: 'Pacifica bind rejected (account not deposited/whitelisted)' }
    }

    setAgent({
      publicKey: ephemeral.publicKey, secretKey: ephemeral.secretKey,
      mainAccount, boundAt: Date.now(), mode: 'local',
    })
    return { ok: true, mode: 'local' as BindMode, agentPubkey: ephemeral.publicKey, pacifica: pacificaErr }
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
    mode: agent?.mode ?? null,
    boundFor: agent?.mainAccount ?? null,
    bind,
    signOrder,
    unbind,
  }
}
