'use client'
import { PrivyProvider } from '@privy-io/react-auth'

// Valid Privy app IDs start with 'cm' or 'cl' followed by alphanumeric chars
function isValidPrivyAppId(id: string | undefined): boolean {
  if (!id) return false
  if (id === 'your-privy-app-id-here') return false
  return /^c[lm][a-z0-9]{20,}$/.test(id)
}

export default function PrivyWrapper({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim()

  if (!isValidPrivyAppId(appId)) {
    return <>{children}</>
  }

  return (
    <PrivyProvider
      appId={appId!}
      config={{
        loginMethods: ['wallet', 'email'],
        appearance: { theme: 'dark', accentColor: '#3b82f6' },
        embeddedWallets: {
          ethereum: { createOnLogin: 'users-without-wallets' },
          solana: { createOnLogin: 'users-without-wallets' },
        },
      }}
    >
      {children}
    </PrivyProvider>
  )
}
