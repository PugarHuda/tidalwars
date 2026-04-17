'use client'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { Competition, Position } from '@/lib/types'
import type { ChatMessage } from '@/lib/chat'
import { getActiveShip, DEFAULT_SHIP } from '@/lib/shipShop'

interface Props {
  comp: Competition
  symbol: string
  currentPrice: number
  prices: Record<string, number>
  myUserId: string
  chat: ChatMessage[]
}

interface ShipState {
  userId: string
  displayName: string
  pnlPct: number
  hasPositionOnSymbol: boolean
  side: 'bid' | 'ask' | null
  leverage: number
  isMe: boolean
  customShip: string | null   // user's chosen ship emoji (mine only — others use default)
}

function defaultShipFor(pnlPct: number, hasPosition: boolean): string {
  if (!hasPosition) return '🌫️'
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
  comp, symbol, currentPrice, prices, myUserId, chat,
}: Props) {
  const W = 480, H = 200

  // User's selected ship (from shop) — only for own ship
  const [myShip, setMyShip] = useState<string>(DEFAULT_SHIP.emoji)
  useEffect(() => {
    setMyShip(getActiveShip())
    // Re-read on storage changes (from ship shop modal)
    const onStorage = () => setMyShip(getActiveShip())
    window.addEventListener('storage', onStorage)
    window.addEventListener('ship-changed', onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('ship-changed', onStorage)
    }
  }, [])

  const ships: ShipState[] = useMemo(() => {
    const out: ShipState[] = []
    for (const [uid, p] of Object.entries(comp.participants)) {
      const posOnSym = p.positions
        .filter((x: Position) => x.symbol === symbol)
        .sort((a, b) => (b.entryPrice * b.amount) - (a.entryPrice * a.amount))[0]

      let pnlPct = 0
      if (posOnSym) {
        const cur = (prices[symbol] && prices[symbol] > 0) ? prices[symbol] : posOnSym.entryPrice
        const diff = posOnSym.side === 'bid' ? cur - posOnSym.entryPrice : posOnSym.entryPrice - cur
        pnlPct = posOnSym.entryPrice > 0 ? (diff / posOnSym.entryPrice) * 100 * posOnSym.leverage : 0
      } else {
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
        customShip: uid === myUserId ? myShip : null,
      })
    }
    return out.sort((a, b) => {
      if (a.hasPositionOnSymbol !== b.hasPositionOnSymbol) return a.hasPositionOnSymbol ? -1 : 1
      return b.pnlPct - a.pnlPct
    })
  }, [comp, symbol, prices, myUserId, myShip])

  // Recent chat bubbles per user — show last message within 5s
  const recentChatByUser = useMemo(() => {
    const now = Date.now()
    const m: Record<string, { text: string; ts: number }> = {}
    for (const msg of chat) {
      if (now - msg.timestamp > 5000) continue
      const prev = m[msg.userId]
      if (!prev || msg.timestamp > prev.ts) {
        m[msg.userId] = { text: msg.text, ts: msg.timestamp }
      }
    }
    return m
  }, [chat])

  // Animation tick — drives wave motion + ship riding
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let raf = 0
    const step = () => { setTick(t => (t + 1) % 100000); raf = requestAnimationFrame(step) }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Session change for wave dynamics
  const initialPriceRef = useRef(currentPrice)
  if (initialPriceRef.current === 0 && currentPrice > 0) initialPriceRef.current = currentPrice
  const sessionChangePct = initialPriceRef.current > 0
    ? ((currentPrice - initialPriceRef.current) / initialPriceRef.current) * 100 : 0
  const absPct = Math.abs(sessionChangePct)

  const waveAmp = Math.min(32, 6 + absPct * 3.5)
  const waveDur = Math.max(1.2, 5 - absPct * 0.6)
  const isStormy = absPct >= 3
  const isTsunami = absPct >= 6
  const seaLevelY = H * 0.5

  // Ship rides the actual wave — compute wave height at ship's X position
  // Wave has 4 humps across W. Phase driven by RAF tick + wave period.
  const waveSpeed = (1 / waveDur) // cycles per second
  const phaseRadians = (tick / 60) * waveSpeed * 2 * Math.PI  // 60fps assumed
  function waveOffsetAt(x: number): number {
    // 4 humps across width → frequency = 4 cycles per W pixels
    const normX = (x / W) * 4 * 2 * Math.PI
    return Math.sin(normX + phaseRadians) * waveAmp * 0.4
  }

  return (
    <div style={{ borderBottom: '2px solid #000', background: 'var(--surface-2)', position: 'relative', overflow: 'hidden' }}>
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

        <rect x="0" y="0" width={W} height={seaLevelY} fill="url(#sky)" />
        <rect x="0" y={seaLevelY} width={W} height={H - seaLevelY} fill="url(#sea)" />

        <text x="8" y="14" fontSize="8" fill="var(--profit)" fontWeight="900" opacity="0.4">PROFIT ↑</text>
        <text x="8" y={H - 6} fontSize="8" fill="var(--loss)" fontWeight="900" opacity="0.4">LOSS ↓</text>
        <line x1="0" y1={seaLevelY} x2={W} y2={seaLevelY}
          stroke="var(--teal)" strokeWidth="0.5" strokeDasharray="4,3" opacity="0.4" />

        {/* Far wave (SMIL for clean loop) */}
        <path fill="var(--teal)" opacity={isStormy ? 0.3 : 0.2}>
          <animate attributeName="d" dur={`${waveDur}s`} repeatCount="indefinite"
            values={`M0,${seaLevelY} Q60,${seaLevelY - waveAmp} 120,${seaLevelY} T240,${seaLevelY} T360,${seaLevelY} T480,${seaLevelY} L${W},${H} L0,${H} Z;
                     M0,${seaLevelY} Q60,${seaLevelY + waveAmp} 120,${seaLevelY} T240,${seaLevelY} T360,${seaLevelY} T480,${seaLevelY} L${W},${H} L0,${H} Z;
                     M0,${seaLevelY} Q60,${seaLevelY - waveAmp} 120,${seaLevelY} T240,${seaLevelY} T360,${seaLevelY} T480,${seaLevelY} L${W},${H} L0,${H} Z`} />
        </path>

        {isStormy && (
          <path fill={isTsunami ? 'var(--loss)' : 'var(--gold)'} opacity="0.2">
            <animate attributeName="d" dur={`${Math.max(0.8, 3.5 - absPct * 0.4).toFixed(1)}s`} repeatCount="indefinite"
              values={`M0,${seaLevelY + 4} Q40,${seaLevelY - waveAmp * 0.7} 80,${seaLevelY + 4} T160,${seaLevelY + 4} T240,${seaLevelY + 4} T320,${seaLevelY + 4} T400,${seaLevelY + 4} T480,${seaLevelY + 4} L${W},${H} L0,${H} Z;
                       M0,${seaLevelY + 4} Q40,${seaLevelY + waveAmp * 0.7} 80,${seaLevelY + 4} T160,${seaLevelY + 4} T240,${seaLevelY + 4} T320,${seaLevelY + 4} T400,${seaLevelY + 4} T480,${seaLevelY + 4} L${W},${H} L0,${H} Z;
                       M0,${seaLevelY + 4} Q40,${seaLevelY - waveAmp * 0.7} 80,${seaLevelY + 4} T160,${seaLevelY + 4} T240,${seaLevelY + 4} T320,${seaLevelY + 4} T400,${seaLevelY + 4} T480,${seaLevelY + 4} L${W},${H} L0,${H} Z`} />
          </path>
        )}

        {isTsunami && Array.from({ length: 3 }).map((_, i) => (
          <text key={i} x={60 + i * 150} y="30" fontSize="16" opacity="0.7"
            style={{ animation: `flash 2s ease-in-out infinite ${i * 0.6}s` }}>⚡</text>
        ))}

        {/* Ships — ride the actual wave */}
        {ships.map((ship, i) => {
          const step = (W - 60) / Math.max(1, ships.length)
          const x = 30 + step * i + step / 2
          const baseY = yFor(ship.pnlPct, H)

          // Actual wave-riding offset (follows the SMIL wave below)
          const waveRide = waveOffsetAt(x)
          // Additional choppy bob in storms
          const choppyBob = isStormy
            ? Math.sin((tick + i * 13) * 0.15) * (isTsunami ? 4 : 2)
            : 0

          // Sinking animation for bad losses
          const isSinking = ship.pnlPct <= -5 && ship.hasPositionOnSymbol
          const sinkOffset = isSinking
            ? Math.min((H - baseY) * 0.4, 2 + Math.sin(tick * 0.02) * 1)
            : 0
          const sinkRotation = isSinking ? Math.sin(tick * 0.03) * 15 : 0

          const y = baseY + waveRide + choppyBob + sinkOffset
          const emoji = ship.customShip ?? defaultShipFor(ship.pnlPct, ship.hasPositionOnSymbol)
          const color = ship.pnlPct >= 0 ? 'var(--profit)' : 'var(--loss)'
          const isDim = !ship.hasPositionOnSymbol
          const labelColor = ship.isMe ? 'var(--teal)' : 'var(--text)'
          const shipOpacity = isDim ? 0.55 : (isSinking ? 0.7 : 1)

          // Chat bubble for this user (if they chatted in last 5s)
          const bubble = recentChatByUser[ship.userId]

          return (
            <g key={ship.userId} opacity={shipOpacity}>
              {/* Sinking bubbles trail */}
              {isSinking && (
                <>
                  <circle cx={x - 4} cy={y + 8 + Math.sin(tick * 0.08) * 3} r="1.5"
                    fill="var(--teal)" opacity="0.4" />
                  <circle cx={x + 5} cy={y + 10 + Math.cos(tick * 0.09) * 4} r="1"
                    fill="var(--teal)" opacity="0.5" />
                  <circle cx={x - 2} cy={y + 14 + Math.sin(tick * 0.07 + 1) * 2} r="0.8"
                    fill="var(--teal)" opacity="0.6" />
                </>
              )}

              {/* Own-ship halo ring */}
              {ship.isMe && (
                <circle cx={x} cy={y - 1} r="11"
                  fill="none" stroke="var(--teal)" strokeWidth="1"
                  strokeDasharray="2,2" opacity="0.8" />
              )}

              {/* Ship emoji, rotated if sinking */}
              <text x={x} y={y + 3} fontSize="13" textAnchor="middle"
                transform={sinkRotation !== 0 ? `rotate(${sinkRotation}, ${x}, ${y})` : undefined}>
                {emoji}
              </text>

              <text x={x} y={y - 11} fontSize="7" fontWeight="900"
                fill={labelColor} textAnchor="middle">
                {ship.displayName.slice(0, 8)}
              </text>

              <text x={x} y={y + 14} fontSize="7" fontWeight="900"
                fill={color} textAnchor="middle">
                {ship.pnlPct >= 0 ? '+' : ''}{ship.pnlPct.toFixed(1)}%
              </text>

              {ship.hasPositionOnSymbol && (
                <text x={x + 10} y={y - 4} fontSize="6" fontWeight="900"
                  fill={ship.side === 'bid' ? 'var(--profit)' : 'var(--loss)'}>
                  {ship.side === 'bid' ? 'L' : 'S'}{ship.leverage}×
                </text>
              )}

              {/* Chat speech bubble above ship */}
              {bubble && (() => {
                const age = (Date.now() - bubble.ts) / 5000  // 0→1 over 5 seconds
                const opacity = Math.max(0, 1 - age)
                const truncated = bubble.text.slice(0, 18) + (bubble.text.length > 18 ? '…' : '')
                const bubbleW = Math.max(40, truncated.length * 4.5)
                const bubbleH = 14
                const bubbleY = y - 28
                return (
                  <g opacity={opacity}>
                    {/* Bubble body */}
                    <rect x={x - bubbleW / 2} y={bubbleY - bubbleH + 2}
                      width={bubbleW} height={bubbleH} rx="6"
                      fill="var(--surface)" stroke="var(--teal)" strokeWidth="1" />
                    {/* Tail */}
                    <path d={`M${x - 3},${bubbleY + 1} L${x},${bubbleY + 5} L${x + 3},${bubbleY + 1} Z`}
                      fill="var(--surface)" stroke="var(--teal)" strokeWidth="1" />
                    <text x={x} y={bubbleY - 3} fontSize="6.5" fontWeight="700"
                      fill="var(--text)" textAnchor="middle">
                      {truncated}
                    </text>
                  </g>
                )
              })()}
            </g>
          )
        })}

        {ships.length === 0 && (
          <>
            <text x={W / 2} y={H / 2} fontSize="11" fill="var(--text-muted)"
              textAnchor="middle" fontWeight="900">EMPTY OCEAN</text>
            <text x={W / 2} y={H / 2 + 14} fontSize="9" fill="var(--text-dim)"
              textAnchor="middle">Join the arena to launch your ship</text>
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
