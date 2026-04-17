'use client'
import { usePrivy } from '@privy-io/react-auth'
import { Wallet, LogOut, ShieldCheck, Zap, Copy, Check, ExternalLink } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const PRIVY_APP_ID = (process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '').trim()
const PRIVY_ENABLED =
  PRIVY_APP_ID.length >= 20 &&
  /^c[lm]/.test(PRIVY_APP_ID) &&
  PRIVY_APP_ID !== 'your-privy-app-id-here'

interface WalletBalance {
  balance: number | null
  equity: number | null
  marginUsed: number | null
  hasApprovedTidalwars: boolean
}

function WalletDropdown({ addr, onLogout }: { addr: string; onLogout: () => void }) {
  const [bal, setBal] = useState<WalletBalance | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`/api/pacifica/balance?wallet=${addr}`)
      .then(r => r.json())
      .then(d => setBal({
        balance: d.balance, equity: d.equity, marginUsed: d.marginUsed,
        hasApprovedTidalwars: Boolean(d.hasApprovedTidalwars),
      }))
      .catch(() => {})
  }, [addr])

  function copyAddr() {
    navigator.clipboard.writeText(addr).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div className="absolute right-0 top-full mt-2 nb-card"
      style={{
        minWidth: 300, zIndex: 120,
        borderColor: 'var(--teal)', borderWidth: 3, boxShadow: '6px 6px 0px #000',
      }}
      onClick={e => e.stopPropagation()}>

      <div className="px-3 py-2 flex items-center justify-between"
        style={{ background: 'var(--teal)', borderBottom: '2px solid #000' }}>
        <div className="flex items-center gap-2 font-black text-xs tracking-widest" style={{ color: '#000' }}>
          <ShieldCheck className="w-3.5 h-3.5" />
          PRIVY SOLANA WALLET
        </div>
      </div>

      {/* Address */}
      <div className="p-3" style={{ borderBottom: '1px solid var(--border-soft)' }}>
        <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Address</div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs" style={{ color: 'var(--text)', wordBreak: 'break-all' }}>
            {addr}
          </span>
          <button onClick={copyAddr} className="nb-btn nb-btn-ghost py-1 px-1.5 shrink-0"
            title="Copy address">
            {copied ? <Check className="w-3 h-3" style={{ color: 'var(--profit)' }} /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Real Pacifica balance */}
      <div className="p-3" style={{ borderBottom: '1px solid var(--border-soft)' }}>
        <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>REAL PACIFICA TESTNET</div>
        {bal === null ? (
          <div className="text-xs" style={{ color: 'var(--text-dim)' }}>Loading balance...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Balance</div>
                <div className="font-mono font-black" style={{ color: 'var(--teal)' }}>
                  ${(bal.balance ?? 0).toFixed(2)}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Equity</div>
                <div className="font-mono font-black" style={{ color: 'var(--text)' }}>
                  ${(bal.equity ?? 0).toFixed(2)}
                </div>
              </div>
            </div>
            {bal.balance !== null && bal.balance < 10 && (
              <a href="https://test-app.pacifica.fi/" target="_blank" rel="noopener noreferrer"
                className="mt-2 flex items-center gap-1 text-xs font-black"
                style={{ color: 'var(--gold)' }}>
                <ExternalLink className="w-3 h-3" /> Deposit testnet USDC
              </a>
            )}
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {bal.hasApprovedTidalwars ? '✅' : '⏳'} TIDALWARS builder code
              </span>
              <span className="text-xs" style={{ color: 'var(--text-dim)', fontSize: '10px' }}>
                {bal.hasApprovedTidalwars ? 'approved' : 'not approved yet'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* What this wallet does */}
      <div className="p-3" style={{ borderBottom: '1px solid var(--border-soft)' }}>
        <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>WHAT THIS WALLET DOES</div>
        <div className="space-y-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--teal)' }} />
            <span>
              <span style={{ color: 'var(--text)' }}>Identity</span> — your persistent trader handle across all arenas
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Zap className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--gold)' }} />
            <span>
              <span style={{ color: 'var(--text)' }}>Signing</span> — Ed25519-signs real Pacifica orders in TESTNET mode (private key stays in Privy iframe)
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Zap className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--profit)' }} />
            <span>
              <span style={{ color: 'var(--text)' }}>Agent Keys</span> — bind once via Privy, auto-sign every subsequent trade without modal
            </span>
          </div>
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--teal)' }} />
            <span>
              <span style={{ color: 'var(--text)' }}>Rewards</span> — future USDC claim payouts via Fuul will use this address
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-2 flex gap-2">
        <a href={`https://test-app.pacifica.fi/`} target="_blank" rel="noopener noreferrer"
          className="nb-btn nb-btn-ghost flex-1 py-1.5 text-xs">
          <ExternalLink className="w-3 h-3" /> Pacifica app
        </a>
        <button onClick={onLogout}
          className="nb-btn nb-btn-ghost flex-1 py-1.5 text-xs">
          <LogOut className="w-3 h-3" /> Disconnect
        </button>
      </div>
    </div>
  )
}

function PrivyInner({ onConnected }: { onConnected?: (address: string) => void }) {
  const { ready, authenticated, login, logout, user } = usePrivy()
  const addr: string = user?.wallet?.address ?? ''
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (authenticated && addr) {
      localStorage.setItem('userId', addr)
      localStorage.setItem('walletAddress', addr)
      if (!localStorage.getItem('displayName')) {
        localStorage.setItem('displayName', addr.slice(0, 6) + '...' + addr.slice(-4))
      }
      onConnected?.(addr)
    }
  }, [authenticated, addr, onConnected])

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (!ready) {
    return (
      <button disabled className="nb-btn nb-btn-ghost py-1.5 px-4 text-xs opacity-60">
        <Wallet className="w-3.5 h-3.5" /> Loading...
      </button>
    )
  }

  if (authenticated && addr) {
    return (
      <div ref={wrapperRef} className="relative">
        <button onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-xs font-bold nb-btn-ghost nb-btn py-1.5 px-3"
          style={{ letterSpacing: 0, textTransform: 'none' }}
          title="Wallet details + actions">
          <div className="live-dot" />
          {addr.slice(0, 4)}...{addr.slice(-4)}
        </button>
        {open && <WalletDropdown addr={addr} onLogout={() => { logout(); setOpen(false) }} />}
      </div>
    )
  }

  return (
    <button onClick={login} className="nb-btn nb-btn-primary py-1.5 px-4 text-xs">
      <Wallet className="w-3.5 h-3.5" /> Connect Wallet
    </button>
  )
}

export default function WalletButton({ onConnected }: { onConnected?: (address: string) => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) {
    return (
      <button disabled className="nb-btn nb-btn-ghost py-1.5 px-4 text-xs opacity-40">
        <Wallet className="w-3.5 h-3.5" /> Connect Wallet
      </button>
    )
  }

  if (!PRIVY_ENABLED) {
    return (
      <button disabled className="nb-btn nb-btn-ghost py-1.5 px-4 text-xs opacity-60"
        title="Set NEXT_PUBLIC_PRIVY_APP_ID in env to enable wallet connect">
        <Wallet className="w-3.5 h-3.5" /> Wallet Disabled
      </button>
    )
  }

  return <PrivyInner onConnected={onConnected} />
}
