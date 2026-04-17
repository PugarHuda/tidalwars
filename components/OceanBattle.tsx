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
  pnlPct: number            // Their PnL% (total realized + unrealized on current symbol)
  hasPositionOnSymbol: boolean
  side: 'bid' | 'ask' | null
  leverage: number
  isMe: boolean
}

/**
 * Pick ship emoji by PnL tier. Differentiated: active traders get boat
 * emoji, spectator-style participants (no positions) get ghostly/neutral.
 */
function shipFor(pnlPct: number, hasPosition: boolean): string {
  if (!hasPosition) return '🌫️'          // fog — lurking, no active position on this symbol
  if (pnlPct >= 15)  return '🐋'
  if (pnlPct >= 5)   return '🛥️'
  if (pnlPct >= 1)   return '⛵'
  if (pnlPct >= -1)  return '🚣'
  if (pnlPct >= -5)  return '🚢'
  return '⚓'
}

function yFor(pnlPct: number, height: number): number {
  const mid = height * 0.5
  const range = height * 0.35
  const clamped = Math.max(-10, Math.min(10, pnlPct))
  return mid - (clamped / 10) * range
}

export const OceanBattle = memo(function OceanBattle({
  comp, symbol, currentPrice, prices, myUserId,
}: Props) {
  const W = 480, H = 200  // bumped height for more ship breathing room

  // Build ship list from ALL participants (not just those with position on symbol)
  const ships: ShipState[] = useMemo(() => {
    const out: ShipState[] = []
    for (const [uid, p] of Object.entries(comp.participants)) {
      // Find largest-notional position on selected symbol (if any)
      const posOnSym = p.positions
        .filter((x: Position) => x.symbol === symbol)
        .sort((a, b) => (b.entryPrice * b.amount) - (a.entryPrice * a.amount))[0]

      let pnlPct = 0
      if (posOnSym) {
        const cur = (prices[symbol] && prices[symbol] > 0) ? prices[symbol] : posOnSym.entryPrice
        const diff = posOnSym.side === 'bid' ? cur - posOnSym.entryPrice : posOnSym.entryPrice - cur
        pnlPct = posOnSym.entryPrice > 0 ? (diff / posOnSym.entryPrice) * 100 * posOnSym.leverage : 0
      } else {
        // User has no position on this symbol — show their realized PnL% as overall standing
        // (encourages them to trade the selected symbol to move up)
        pnlPct = (p.realizedPnl / 10000) * 100
      }

      out.push({
        userId: uid,
        displayName: p.displayName,
        pnlPct,
        hasPositionOnSymbol: !!posOnSym,
        side: posOnSym?.side ?? null,
        leverage: posOnSym?.leverage ?? 0,
        isMe: uid === myUserId,
      })
    }
    // Sort: active positions first, then by PnL desc
    return out.sort((a, b) => {
      if (a.hasPositionOnSymbol !== b.hasPositionOnSymbol) return a.hasPositionOnSymbol ? -1 : 1
      return b.pnlPct - a.pnlPct
    })
  }, [comp, symbol, prices, myUserId])

  // Gentle bobbing
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let raf = 0
    const step = () => { setTick(t => (t + 1) % 1000); raf = requestAnimationFrame(step) }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Session change % for wave dynamics — MORE DRAMATIC now
  const initialPriceRef = useRef(currentPrice)
  if (initialPriceRef.current === 0 && currentPrice > 0) initialPriceRef.current = currentPrice
  const sessionChangePct = initialPriceRef.current > 0
    ? ((currentPrice - initialPriceRef.current) / initialPriceRef.current) * 100 : 0
  const absPct = Math.abs(sessionChangePct)

  // Waves are now MUCH more dramatic: amp 6→32px, speed 6s→1.2s
  const waveAmp = Math.min(32, 6 + absPct * 3.5)
  const waveDur = Math.max(1.2, 5 - absPct * 0.6).toFixed(1)
  // Storm threshold
  const isStormy = absPct >= 3
  const isTsunami = absPct >= 6
  const seaLevelY = H * 0.5

  // Secondary wave (offset, faster) layered for "choppy water" feel when volatile
  const wave2Amp = Math.min(24, 3 + absPct * 2.5)
  const wave2Dur = Math.max(0.8, 3.5 - absPct * 0.4).toFixed(1)

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
            {ships.length} sailor{ships.length !== 1 ? 's' : ''}
          </span>
          {isStormy && (
            <span className="text-xs px-1.5 py-0.5 font-black animate-pulse" style={{
              background: isTsunami ? 'var(--loss)' : 'var(--gold)',
              color: isTsunami ? '#fff' : '#000', border: '1px solid #000', fontSize: '9px',
            }}>
              {isTsunami ? '🌊 TSUNAMI' : '⚡ STORM'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>SEA</span>
          <span className="font-mono font-black" style={{ color: sessionChangePct >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
            ${currentPrice > 0 ? (currentPrice >= 100 ? currentPrice.toFixed(2) : currentPrice.toFixed(4)) : '—'}
          </span>
          <span className="font-mono" style={{ fontSize: '10px',
            color: sessionChangePct >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
            {sessionChangePct >= 0 ? '+' : ''}{sessionChangePct.toFixed(2)}%
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={isStormy ? 'var(--surface)' : 'var(--surface-3)'} />
            <stop offset="1" stopColor="var(--surface-2)" />
          </linearGradient>
          <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={isStormy ? (isTsunami ? 'var(--loss)' : 'var(--gold)') : 'var(--teal)'} stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--surface-3)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Sky / Sea backgrounds */}
        <rect x="0" y="0" width={W} height={seaLevelY} fill="url(#sky)" />
        <rect x="0" y={seaLevelY} width={W} height={H - seaLevelY} fill="url(#sea)" />

        {/* Zone labels (dimmer) */}
        <text x="8" y="14" fontSize="8" fill="var(--profit)" fontWeight="900" opacity="0.4">PROFIT ↑</text>
        <text x="8" y={H - 6} fontSize="8" fill="var(--loss)" fontWeight="900" opacity="0.4">LOSS ↓</text>

        {/* Midline dashed */}
        <line x1="0" y1={seaLevelY} x2={W} y2={seaLevelY}
          stroke="var(--teal)" strokeWidth="0.5" strokeDasharray="4,3" opacity="0.4" />

        {/* Far wave (slower, wider) */}
        <path fill="var(--teal)" opacity={isStormy ? 0.3 : 0.2}>
          <animate attributeName="d" dur={`${waveDur}s`} repeatCount="indefinite"
            values={`M0,${seaLevelY} Q60,${seaLevelY - waveAmp} 120,${seaLevelY} T240,${seaLevelY} T360,${seaLevelY} T480,${seaLevelY} L${W},${H} L0,${H} Z;
                     M0,${seaLevelY} Q60,${seaLevelY + waveAmp} 120,${seaLevelY} T240,${seaLevelY} T360,${seaLevelY} T480,${seaLevelY} L${W},${H} L0,${H} Z;
                     M0,${seaLevelY} Q60,${seaLevelY - waveAmp} 120,${seaLevelY} T240,${seaLevelY} T360,${seaLevelY} T480,${seaLevelY} L${W},${H} L0,${H} Z`} />
        </path>

        {/* Near wave (faster, bigger chop — only when stormy) */}
        {isStormy && (
          <path fill={isTsunami ? 'var(--loss)' : 'var(--gold)'} opacity="0.2">
            <animate attributeName="d" dur={`${wave2Dur}s`} repeatCount="indefinite"
              values={`M0,${seaLevelY + 4} Q40,${seaLevelY - wave2Amp} 80,${seaLevelY + 4} T160,${seaLevelY + 4} T240,${seaLevelY + 4} T320,${seaLevelY + 4} T400,${seaLevelY + 4} T480,${seaLevelY + 4} L${W},${H} L0,${H} Z;
                       M0,${seaLevelY + 4} Q40,${seaLevelY + wave2Amp} 80,${seaLevelY + 4} T160,${seaLevelY + 4} T240,${seaLevelY + 4} T320,${seaLevelY + 4} T400,${seaLevelY + 4} T480,${seaLevelY + 4} L${W},${H} L0,${H} Z;
                       M0,${seaLevelY + 4} Q40,${seaLevelY - wave2Amp} 80,${seaLevelY + 4} T160,${seaLevelY + 4} T240,${seaLevelY + 4} T320,${seaLevelY + 4} T400,${seaLevelY + 4} T480,${seaLevelY + 4} L${W},${H} L0,${H} Z`} />
          </path>
        )}

        {/* Lightning bolts during tsunami */}
        {isTsunami && Array.from({ length: 3 }).map((_, i) => {
          const delay = i * 0.6
          const xPos = 60 + i * 150
          return (
            <g key={i} opacity="0.7">
              <text x={xPos} y="30" fontSize="16" style={{ animation: `flash 2s ease-in-out infinite ${delay}s` }}>
                ⚡
              </text>
            </g>
          )
        })}

        {/* Ships — smaller, tighter layout */}
        {ships.map((ship, i) => {
          const step = (W - 60) / Math.max(1, ships.length)
          const x = 30 + step * i + step / 2
          const baseY = yFor(ship.pnlPct, H)
          // Bobbing intensity scales with volatility
          const bobAmp = isStormy ? (isTsunami ? 6 : 4) : 2
          const bob = Math.sin((tick + i * 17) * 0.05) * bobAmp
          const y = baseY + bob
          const emoji = shipFor(ship.pnlPct, ship.hasPositionOnSymbol)
          const color = ship.pnlPct >= 0 ? 'var(--profit)' : 'var(--loss)'
          const isDim = !ship.hasPositionOnSymbol
          const labelColor = ship.isMe ? 'var(--teal)' : 'var(--text)'
          const shipOpacity = isDim ? 0.55 : 1

          return (
            <g key={ship.userId} opacity={shipOpacity}>
              {/* Own-ship halo ring */}
              {ship.isMe && (
                <circle cx={x} cy={y - 1} r="11"
                  fill="none" stroke="var(--teal)" strokeWidth="1"
                  strokeDasharray="2,2" opacity="0.8" />
              )}
              {/* Ship emoji — MUCH smaller */}
              <text x={x} y={y + 3} fontSize="13" textAnchor="middle">
                {emoji}
              </text>
              {/* Name label — tighter */}
              <text x={x} y={y - 11} fontSize="7" fontWeight="900"
                fill={labelColor} textAnchor="middle">
                {ship.displayName.slice(0, 8)}
              </text>
              {/* PnL pct small */}
              <text x={x} y={y + 14} fontSize="7" fontWeight="900"
                fill={color} textAnchor="middle">
                {ship.pnlPct >= 0 ? '+' : ''}{ship.pnlPct.toFixed(1)}%
              </text>
              {/* Side badge (only if has position on this symbol) */}
              {ship.hasPositionOnSymbol && (
                <text x={x + 10} y={y - 4} fontSize="6" fontWeight="900"
                  fill={ship.side === 'bid' ? 'var(--profit)' : 'var(--loss)'}>
                  {ship.side === 'bid' ? 'L' : 'S'}{ship.leverage}×
                </text>
              )}
            </g>
          )
        })}

        {ships.length === 0 && (
          <>
            <text x={W / 2} y={H / 2} fontSize="11" fill="var(--text-muted)"
              textAnchor="middle" fontWeight="900">
              EMPTY OCEAN
            </text>
            <text x={W / 2} y={H / 2 + 14} fontSize="9" fill="var(--text-dim)" textAnchor="middle">
              Join the arena to launch your ship
            </text>
          </>
        )}

        <style>{`
          @keyframes flash {
            0%, 100% { opacity: 0; }
            10%, 15% { opacity: 1; }
            50% { opacity: 0; }
          }
        `}</style>
      </svg>
    </div>
  )
})
