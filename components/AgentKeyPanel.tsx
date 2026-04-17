'use client'
import { useState } from 'react'
import { Zap, KeyRound, ShieldCheck, AlertCircle, X } from 'lucide-react'
import { usePrivySolanaSign } from '@/lib/usePrivySolanaSign'
import type { UseAgentKey } from '@/lib/useAgentKey'

interface Props {
  agentKey: UseAgentKey
}

/**
 * Displayable control to bind/unbind a Pacifica Agent Key.
 *
 * Pre-bind: "Enable Fast Trading" CTA. Clicking pops one Privy modal,
 *   generates an ephemeral Solana keypair, and asks Pacifica to authorize
 *   that agent to trade on the user's behalf for this session.
 * Post-bind: "Agent Active" badge + agent pubkey preview + unbind.
 *
 * This is ONLY visible when Privy wallet is connected.
 */
export default function AgentKeyPanel({ agentKey }: Props) {
  const privy = usePrivySolanaSign()
  const [binding, setBinding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!privy.ready) return null // no wallet, no agent

  async function handleBind() {
    setError(null)
    setBinding(true)
    try {
      const res = await agentKey.bind(privy)
      if (!res.ok) setError(res.error ?? 'Bind failed')
    } finally {
      setBinding(false)
    }
  }

  if (agentKey.bound && agentKey.agent) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs"
        style={{ background: 'rgba(0,232,122,0.1)', border: '1px solid var(--profit)' }}
        title={`Agent key bound for ${agentKey.agent.mainAccount.slice(0, 8)}...`}>
        <ShieldCheck className="w-3 h-3" style={{ color: 'var(--profit)' }} />
        <span className="font-black" style={{ color: 'var(--profit)' }}>AGENT ACTIVE</span>
        <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '10px' }}>
          {agentKey.agent.publicKey.slice(0, 6)}...{agentKey.agent.publicKey.slice(-4)}
        </span>
        <button onClick={agentKey.unbind}
          className="ml-1 opacity-60 hover:opacity-100"
          style={{ color: 'var(--text-muted)' }}
          title="Revoke this session">
          <X className="w-3 h-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <button onClick={handleBind} disabled={binding}
        className="nb-btn nb-btn-gold py-2 px-3 text-xs flex items-center justify-center gap-1.5"
        style={{ background: 'var(--gold)', color: '#000' }}
        title="One signature. Then every trade skips the modal.">
        {binding ? (
          <>
            <span className="animate-spin inline-block">◌</span> BINDING...
          </>
        ) : (
          <>
            <Zap className="w-3 h-3" /> ENABLE FAST TRADING
            <KeyRound className="w-3 h-3 opacity-70" />
          </>
        )}
      </button>
      {error && (
        <div className="flex items-start gap-1.5 px-2 py-1 text-xs"
          style={{ background: 'rgba(255,68,102,0.1)', border: '1px solid var(--loss)', color: 'var(--loss)' }}>
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
          <span style={{ fontSize: '10px' }}>{error}</span>
        </div>
      )}
    </div>
  )
}
