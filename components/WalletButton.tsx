'use client'
import { usePrivy } from '@privy-io/react-auth'
import { Wallet, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'

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

  if (!ready) return <div className="nb-btn nb-btn-ghost py-1.5 px-4 opacity-40 pointer-events-none animate-pulse" style={{ width: 120 }} />

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
  const [show, setShow] = useState(false)

  useEffect(() => {
    const appId = (process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '').trim()
    setShow(/^c[lm][a-z0-9]{20,}$/.test(appId) && appId !== 'your-privy-app-id-here')
  }, [])

  if (!show) return null
  return <PrivyInner onConnected={onConnected} />
}
