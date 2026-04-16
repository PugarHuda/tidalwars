'use client'
import { useEffect, useState } from 'react'

// Try to import Privy — gracefully falls back if not configured
let usePrivyHook: (() => { authenticated: boolean; user: { wallet?: { address: string } | null } | null; login: () => void; logout: () => void }) | null = null

try {
  // Dynamic check if Privy is properly configured
  const privyAppId = typeof window !== 'undefined'
    ? document.querySelector('meta[name="privy-app-id"]')?.getAttribute('content')
    : null
  if (privyAppId) {
    // Privy is configured — use it
    const { usePrivy } = require('@privy-io/react-auth')
    usePrivyHook = usePrivy
  }
} catch {
  // Privy not available
}

export interface WalletState {
  userId: string
  displayName: string
  walletAddress: string
  isConnected: boolean
  setDisplayName: (name: string) => void
}

export function useWallet(): WalletState {
  const [userId, setUserId] = useState('')
  const [displayName, setDisplayNameState] = useState('')
  const [walletAddress, setWalletAddress] = useState('')

  useEffect(() => {
    // Generate or retrieve anonymous userId
    let uid = localStorage.getItem('userId')
    if (!uid) {
      uid = `user_${Math.random().toString(36).slice(2, 9)}`
      localStorage.setItem('userId', uid)
    }
    setUserId(uid)

    const dn = localStorage.getItem('displayName') ?? ''
    setDisplayNameState(dn)

    const wa = localStorage.getItem('walletAddress') ?? ''
    setWalletAddress(wa)
  }, [])

  const setDisplayName = (name: string) => {
    localStorage.setItem('displayName', name)
    setDisplayNameState(name)
  }

  return { userId, displayName, walletAddress, isConnected: !!walletAddress, setDisplayName }
}
