import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import PrivyWrapper from '@/components/PrivyWrapper'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'TidalWars — PvP Perps on Pacifica',
  description: 'Compete in real-time perpetual futures trading competitions on Pacifica DEX. Best PnL wins.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen`} style={{ background: 'var(--bg)', color: 'white' }}>
        <PrivyWrapper>{children}</PrivyWrapper>
      </body>
    </html>
  )
}
