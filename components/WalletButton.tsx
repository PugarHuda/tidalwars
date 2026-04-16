'use client'
import { usePrivy } from '@privy-io/react-auth'
import { Wallet, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'

const PRIVY_APP_ID = (process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '').trim()
const PRIVY_ENABLED =
  PRIVY_APP_ID.length >= 20 &&
  /^c[lm]/.test(PRIVY_APP_ID) &&
  PRIVY_APP_ID !== 'your-privy-app-id-here'

function PrivyInner({ onConnected }: { onConnected?: (address: string) => void }) {
  const { ready, authenticated, login, logout, user } = usePrivy()
  const addr: string = user?.wallet?.address ?? ''

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

  if (!ready) {
    return (
      <button disabled className="nb-btn nb-btn-ghost py-1.5 px-4 text-xs opacity-60">
        <Wallet className="w-3.5 h-3.5" /> Loading...
      </button>
    )
  }

  if (authenticated && addr) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 text-xs font-bold nb-btn-ghost nb-btn py-1.5 px-3 pointer-events-none"
          style={{ letterSpacing: 0, textTransform: 'none' }}>
          <div className="live-dot" />
          {addr.slice(0, 4)}...{addr.slice(-4)}
        </div>
        <button onClick={logout} className="nb-btn nb-btn-ghost py-1.5 px-2" title="Disconnect">
          <LogOut className="w-3.5 h-3.5" />
        </button>
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

  // Pre-hydration: render a disabled placeholder so layout doesn't shift
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
