'use client'
import { useState } from 'react'
import { Zap, ShieldCheck, AlertCircle, X, Info } from 'lucide-react'
import { usePrivySolanaSign } from '@/lib/usePrivySolanaSign'
import type { UseAgentKey } from '@/lib/useAgentKey'

interface Props {
  agentKey: UseAgentKey
}

export default function AgentKeyPanel({ agentKey }: Props) {
  const privy = usePrivySolanaSign()
  const [binding, setBinding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)

  if (!privy.ready) return null

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
    const isPacifica = agentKey.mode === 'pacifica'
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-xs"
        style={{
          background: isPacifica ? 'rgba(0,232,122,0.1)' : 'rgba(255,215,0,0.08)',
          border: `1px solid ${isPacifica ? 'var(--profit)' : 'var(--gold)'}`,
        }}
        title={isPacifica
          ? `Pacifica-registered agent ${agentKey.agent.publicKey.slice(0, 10)}… — real orders auto-sign`
          : `Local session mode — fast trading for virtual orders (Pacifica account not whitelisted)`}>
        <ShieldCheck className="w-3 h-3" style={{ color: isPacifica ? 'var(--profit)' : 'var(--gold)' }} />
        <span className="font-black text-xs" style={{ color: isPacifica ? 'var(--profit)' : 'var(--gold)' }}>
          {isPacifica ? 'AGENT' : 'SESSION'}
        </span>
        <button onClick={agentKey.unbind}
          className="ml-0.5 opacity-50 hover:opacity-100"
          style={{ color: 'var(--text-muted)' }}
          title="End session">
          <X className="w-3 h-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <button onClick={handleBind} disabled={binding}
          className="py-1 px-2 text-xs font-black tracking-wider flex items-center gap-1"
          style={{
            background: 'var(--gold)',
            color: '#000',
            border: '2px solid #000',
            boxShadow: '2px 2px 0px #000',
          }}
          title="Skip the signing modal for every trade. Signs once with Privy.">
          {binding ? (
            <>
              <span className="animate-spin inline-block">◌</span> BINDING
            </>
          ) : (
            <>
              <Zap className="w-3 h-3" /> FAST TRADE
            </>
          )}
        </button>
        <button onClick={() => setShowInfo(s => !s)}
          className="nb-btn nb-btn-ghost py-1 px-1.5"
          title="What is Fast Trade?">
          <Info className="w-3 h-3" />
        </button>
      </div>

      {showInfo && (
        <div className="absolute right-0 top-full mt-1 nb-card p-3 z-50"
          style={{ width: 280, borderColor: 'var(--gold)', borderWidth: 2 }}>
          <div className="text-xs font-black tracking-widest mb-2" style={{ color: 'var(--gold)' }}>
            ⚡ FAST TRADE
          </div>
          <div className="text-xs mb-2" style={{ color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Generates an ephemeral keypair in memory. You sign ONCE via Privy, and
            the key auto-signs every subsequent trade — no more signing modal per
            order.
          </div>
          <div className="text-xs p-2 mb-2" style={{
            background: 'rgba(0,232,122,0.06)', border: '1px solid var(--profit)',
            color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1.4,
          }}>
            <span className="font-black" style={{ color: 'var(--profit)' }}>⚓ AGENT mode</span>
            {' — Pacifica registers the agent via /agent/bind. Works fully on-chain.'}
          </div>
          <div className="text-xs p-2 mb-2" style={{
            background: 'rgba(255,215,0,0.06)', border: '1px solid var(--gold)',
            color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1.4,
          }}>
            <span className="font-black" style={{ color: 'var(--gold)' }}>🌊 SESSION mode</span>
            {' — used when your account isn’t deposited/whitelisted on Pacifica yet. Skips the modal for virtual trades only.'}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-dim)', fontSize: '10px' }}>
            Key dies when you refresh or leave the arena — security by default.
          </div>
        </div>
      )}

      {error && (
        <div className="absolute right-0 top-full mt-1 p-2 text-xs flex items-start gap-1.5 z-50"
          style={{ background: 'var(--surface)', border: '2px solid var(--loss)', width: 280, boxShadow: '4px 4px 0 #000' }}>
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--loss)' }} />
          <div>
            <div className="font-black" style={{ color: 'var(--loss)' }}>Bind failed</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1.4 }}>{error}</div>
            <button onClick={() => setError(null)}
              className="mt-1 text-xs font-black" style={{ color: 'var(--teal)' }}>
              DISMISS
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
