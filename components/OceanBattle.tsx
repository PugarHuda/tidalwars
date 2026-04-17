'use client'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { Competition, Position } from '@/lib/types'

interface Props {
  comp: Competition
  symbol: string
  currentPrice: number
  prices: Record<string, number>
  myUserId: string
}

interface ShipState {
  userId: string
  displayName: string
  pnlPct: number
  side: 'bid' | 'ask'
  leverage: number
  amount: number
  isMe: boolean
}

/**
 * Pick ship emoji by PnL tier. More dramatic wins/losses get more
 * expressive emoji. Whales come out for big wins, sinking ships for
 * big losses.
 */
function shipFor(pnlPct: number): string {
  if (pnlPct >= 15) return '🐋'  // whale — crushing it
  if (pnlPct >= 5)  return '🛥️'   // speedboat — winning hard
  if (pnlPct >= 1)  return '⛵'   // sailboat — cruising
  if (pnlPct >= -1) return '🚣'   // rowboat — barely staying afloat
  if (pnlPct >= -5) return '🚢'   // freighter — taking on water
  return '⚓'                       // anchor — sinking to the bottom
}

/**
 * Y-pixel given pnl% and canvas height. 0% → sea level (midpoint).
 * +10% → near top, -10% → near bottom. Clamped to leave room for labels.
 */
function yFor(pnlPct: number, height: number): number {
  const mid = height * 0.5
  const range = height * 0.35 // ±35% of height for ±10% PnL
  const clamped = Math.max(-10, Math.min(10, pnlPct))
  return mid - (clamped / 10) * range
}

export const OceanBattle = memo(function OceanBattle({
  comp, symbol, currentPrice, prices, myUserId,
}: Props) {
  const W = 480, H = 180

  // Build ship list from all participants with an OPEN position on this symbol
  const ships: ShipState[] = useMemo(() => {
    const out: ShipState[] = []
    for (const [uid, p] of Object.entries(comp.participants)) {
      // Find the most impactful position on this symbol (largest notional)
      const posOnSym = p.positions
        .filter((x: Position) => x.symbol === symbol)
        .sort((a: Position, b: Position) => (b.entryPrice * b.amount) - (a.entryPrice * a.amount))[0]
      if (!posOnSym) continue
      const cur = (prices[symbol] && prices[symbol] > 0) ? prices[symbol] : posOnSym.entryPrice
      const diff = posOnSym.side === 'bid' ? cur - posOnSym.entryPrice : posOnSym.entryPrice - cur
      const pnlPct = posOnSym.entryPrice > 0 ? (diff / posOnSym.entryPrice) * 100 * posOnSym.leverage : 0
      out.push({
        userId: uid,
        displayName: p.displayName,
        pnlPct,
        side: posOnSym.side,
        leverage: posOnSym.leverage,
        amount: posOnSym.amount,
        isMe: uid === myUserId,
      })
    }
    // Sort by PnL descending — best ships on the left
    return out.sort((a, b) => b.pnlPct - a.pnlPct)
  }, [comp, symbol, prices, myUserId])

  // Bobbing animation — each ship bobs ±3px on a slight delay, driven by
  // requestAnimationFrame. Gives the "floating on waves" feel.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let raf = 0
    const step = () => { setTick(t => (t + 1) % 1000); raf = requestAnimationFrame(step) }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Session change % for wave dynamics
  const initialPriceRef = useRef(currentPrice)
  if (initialPriceRef.current === 0 && currentPrice > 0) initialPriceRef.current = currentPrice
  const sessionChangePct = initialPriceRef.current > 0
    ? ((currentPrice - initialPriceRef.current) / initialPriceRef.current) * 100 : 0
  const absPct = Math.abs(sessionChangePct)
  const waveAmp = Math.min(12, 4 + absPct * 1.5)
  const waveDur = Math.max(2.5, 5 - absPct * 0.3).toFixed(1)
  const seaLevelY = H * 0.5

  return (
    <div style={{ borderBottom: '2px solid #000', background: 'var(--surface-2)', position: 'relative', overflow: 'hidden' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--border-soft)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-black tracking-widest" style={{ color: 'var(--teal)' }}>
            🚢 {symbol} BATTLE
          </span>
          <span className="text-xs px-1.5 py-0.5 font-black" style={{
            background: 'var(--surface-3)', border: '1px solid var(--border-soft)',
            color: 'var(--text-muted)', fontSize: '9px',
          }}>
            {ships.length} {ships.length === 1 ? 'ship' : 'ships'} on water
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>SEA LEVEL</span>
          <span className="font-mono font-black" style={{ color: 'var(--teal)' }}>
            ${currentPrice > 0 ? (currentPrice >= 100 ? currentPrice.toFixed(2) : currentPrice.toFixed(4)) : '—'}
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--surface-3)" />
            <stop offset="1" stopColor="var(--surface-2)" />
          </linearGradient>
          <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--teal)" stopOpacity="0.25" />
            <stop offset="1" stopColor="var(--surface-3)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Sky (above sea level) */}
        <rect x="0" y="0" width={W} height={seaLevelY} fill="url(#sky)" />

        {/* Deep sea (below sea level) */}
        <rect x="0" y={seaLevelY} width={W} height={H - seaLevelY} fill="url(#sea)" />

        {/* PROFIT ZONE / LOSS ZONE labels */}
        <text x="8" y="14" fontSize="8" fill="var(--profit)" fontWeight="900" opacity="0.5">
          PROFIT ZONE ↑
        </text>
        <text x="8" y={H - 6} fontSize="8" fill="var(--loss)" fontWeight="900" opacity="0.5">
          LOSS ZONE ↓
        </text>

        {/* Horizontal "midline" dashed */}
        <line x1="0" y1={seaLevelY} x2={W} y2={seaLevelY}
          stroke="var(--teal)" strokeWidth="0.5" strokeDasharray="4,3" opacity="0.4" />

        {/* Animated wave on the sea level */}
        <path fill="var(--teal)" opacity="0.25">
          <animate attributeName="d" dur={`${waveDur}s`} repeatCount="indefinite"
            values={`M0,${seaLevelY} Q60,${seaLevelY - waveAmp} 120,${seaLevelY} T240,${seaLevelY} T360,${seaLevelY} T480,${seaLevelY} L${W},${H} L0,${H} Z;
                     M0,${seaLevelY} Q60,${seaLevelY + waveAmp} 120,${seaLevelY} T240,${seaLevelY} T360,${seaLevelY} T480,${seaLevelY} L${W},${H} L0,${H} Z;
                     M0,${seaLevelY} Q60,${seaLevelY - waveAmp} 120,${seaLevelY} T240,${seaLevelY} T360,${seaLevelY} T480,${seaLevelY} L${W},${H} L0,${H} Z`} />
        </path>

        {/* Ships */}
        {ships.map((ship, i) => {
          const x = ships.length === 1 ? W / 2 : 40 + (i / Math.max(1, ships.length - 1)) * (W - 80)
          const baseY = yFor(ship.pnlPct, H)
          // Per-ship bobbing offset
          const bob = Math.sin((tick + i * 17) * 0.05) * 2.5
          const y = baseY + bob
          const emoji = shipFor(ship.pnlPct)
          const color = ship.pnlPct >= 0 ? 'var(--profit)' : 'var(--loss)'
          const labelColor = ship.isMe ? 'var(--teal)' : 'var(--text)'

          return (
            <g key={ship.userId}>
              {/* Highlight ring for the user's own ship */}
              {ship.isMe && (
                <circle cx={x} cy={y - 2} r="18"
                  fill="none" stroke="var(--teal)" strokeWidth="1.5"
                  strokeDasharray="3,2" opacity="0.7" />
              )}
              {/* Ship emoji */}
              <text x={x} y={y + 6} fontSize="22" textAnchor="middle">
                {emoji}
              </text>
              {/* Name label above ship */}
              <rect x={x - 38} y={y - 24} width="76" height="12"
                fill="var(--surface)" stroke="#000" strokeWidth="0.5" opacity="0.92" />
              <text x={x} y={y - 15} fontSize="8" fontWeight="900"
                fill={labelColor} textAnchor="middle">
                {ship.displayName.slice(0, 10)}
              </text>
              {/* PnL % below ship */}
              <text x={x} y={y + 20} fontSize="9" fontWeight="900"
                fill={color} textAnchor="middle">
                {ship.pnlPct >= 0 ? '+' : ''}{ship.pnlPct.toFixed(1)}%
              </text>
              {/* Side indicator (L/S) */}
              <text x={x + 14} y={y - 8} fontSize="7" fontWeight="900"
                fill={ship.side === 'bid' ? 'var(--profit)' : 'var(--loss)'}>
                {ship.side === 'bid' ? 'L' : 'S'}{ship.leverage}×
              </text>
            </g>
          )
        })}

        {/* Empty state */}
        {ships.length === 0 && (
          <>
            <text x={W / 2} y={H / 2} fontSize="11" fill="var(--text-muted)"
              textAnchor="middle" fontWeight="900">
              NO SHIPS ON WATER YET
            </text>
            <text x={W / 2} y={H / 2 + 14} fontSize="9" fill="var(--text-dim)" textAnchor="middle">
              Open a {symbol} position to launch your ship
            </text>
          </>
        )}
      </svg>
    </div>
  )
})
