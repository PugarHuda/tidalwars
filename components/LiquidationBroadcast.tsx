'use client'
import { useEffect, useState } from 'react'

interface Liq {
  id: string
  displayName: string
  symbol: string
  loss: number
}

export default function LiquidationBroadcast({ liq }: { liq: Liq | null }) {
  const [visible, setVisible] = useState(false)
  const [currentLiq, setCurrentLiq] = useState<Liq | null>(null)

  useEffect(() => {
    if (!liq) return
    setCurrentLiq(liq)
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 2800)
    return () => clearTimeout(t)
  }, [liq?.id])  // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible || !currentLiq) return null

  return (
    <div className="fixed inset-0 z-[175] pointer-events-none flex items-center justify-center"
      style={{
        animation: 'liq-fade 2.8s ease-out forwards',
        background: 'radial-gradient(circle at center, rgba(255,68,102,0.25) 0%, rgba(255,68,102,0) 70%)',
      }}>
      <div className="nb-card px-6 py-4"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--loss)',
          borderWidth: 3,
          boxShadow: '8px 8px 0px #000',
          animation: 'liq-bounce 0.6s ease-out',
          transform: 'rotate(-2deg)',
        }}>
        <div className="flex items-center gap-3">
          <div className="text-5xl" style={{ animation: 'shark-chomp 0.6s ease-in-out infinite alternate' }}>
            🦈
          </div>
          <div>
            <div className="text-xs font-black tracking-[0.3em] mb-0.5" style={{ color: 'var(--loss)' }}>
              LIQUIDATED
            </div>
            <div className="text-2xl font-black" style={{ color: 'var(--text)' }}>
              {currentLiq.displayName.toUpperCase()}
            </div>
            <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
              {currentLiq.symbol} · lost ${Math.abs(currentLiq.loss).toFixed(0)}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes liq-fade {
          0%, 5% { opacity: 0; }
          10% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes liq-bounce {
          0% { transform: rotate(-2deg) scale(0.5); opacity: 0; }
          60% { transform: rotate(-2deg) scale(1.1); opacity: 1; }
          100% { transform: rotate(-2deg) scale(1); opacity: 1; }
        }
        @keyframes shark-chomp {
          from { transform: rotate(-10deg) scale(1); }
          to   { transform: rotate(10deg) scale(1.15); }
        }
      `}</style>
    </div>
  )
}
