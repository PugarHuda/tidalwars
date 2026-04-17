'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Play, Pause, SkipBack, SkipForward, Rewind } from 'lucide-react'
import type { TradeEvent, Competition, LeaderboardEntry } from '@/lib/types'
import type { Candle } from './CandleChart'

interface Props {
  isOpen: boolean
  onClose: () => void
  comp: Competition
  events: TradeEvent[]
  finalLeaderboard: LeaderboardEntry[]
}

const STARTING_BALANCE = 10000
const SPEEDS = [0.5, 1, 2, 4, 8]

/**
 * Compute leaderboard state at a given timestamp — includes only events
 * that happened at or before `asOf`. Snapshots realized PnL for each
 * participant, then sorts + ranks.
 */
function leaderboardAt(
  participants: Competition['participants'],
  events: TradeEvent[],
  asOf: number,
): LeaderboardEntry[] {
  const realized: Record<string, number> = {}
  for (const uid of Object.keys(participants)) realized[uid] = 0
  // Build realized PnL purely from 'close' events with pnl values up to asOf
  for (const ev of [...events].sort((a, b) => a.timestamp - b.timestamp)) {
    if (ev.timestamp > asOf) break
    if (ev.action === 'close' && typeof ev.pnl === 'number') {
      realized[ev.userId] = (realized[ev.userId] ?? 0) + ev.pnl
    }
  }
  return Object.values(participants).map(p => {
    const pnl = realized[p.userId] ?? 0
    return {
      userId: p.userId,
      displayName: p.displayName,
      walletAddress: p.walletAddress,
      unrealizedPnl: 0,
      realizedPnl: pnl,
      totalPnl: pnl,
      roi: (pnl / STARTING_BALANCE) * 100,
      positionCount: 0,
      rank: 0,
    }
  }).sort((a, b) => b.totalPnl - a.totalPnl)
    .map((e, i) => ({ ...e, rank: i + 1 }))
}

export default function ReplayModal({ isOpen, onClose, comp, events, finalLeaderboard }: Props) {
  const sortedEvents = useMemo(() =>
    [...events].sort((a, b) => a.timestamp - b.timestamp),
    [events])

  const [asOf, setAsOf] = useState<number>(comp.startsAt)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(2)
  const lastTickRef = useRef<number>(0)

  // Most-traded symbol in this arena — used to fetch candles for context
  const dominantSymbol = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const ev of sortedEvents) counts[ev.symbol] = (counts[ev.symbol] ?? 0) + 1
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'BTC'
  }, [sortedEvents])

  // Fetch candles for the dominant symbol when modal opens
  const [candles, setCandles] = useState<Candle[]>([])
  useEffect(() => {
    if (!isOpen) return
    // Pick interval based on arena length: 1h arena → 1m candles, longer → 5m
    const durMs = comp.endsAt - comp.startsAt
    const interval = durMs <= 3_600_000 ? '1m' : durMs <= 14_400_000 ? '5m' : '15m'
    const limit = Math.min(300, Math.ceil(durMs / (interval === '1m' ? 60_000 : interval === '5m' ? 300_000 : 900_000)) + 5)
    fetch(`/api/pacifica/kline?symbol=${dominantSymbol}&interval=${interval}&limit=${limit}`)
      .then(r => r.json())
      .then(d => setCandles(Array.isArray(d.candles) ? d.candles : []))
      .catch(() => setCandles([]))
  }, [isOpen, dominantSymbol, comp.startsAt, comp.endsAt])

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setAsOf(comp.startsAt)
      setPlaying(false)
    }
  }, [isOpen, comp.startsAt])

  // Playback loop — advances asOf based on real elapsed time × speed
  useEffect(() => {
    if (!playing) return
    lastTickRef.current = performance.now()
    let raf = 0
    const step = (now: number) => {
      const elapsed = now - lastTickRef.current
      lastTickRef.current = now
      setAsOf(prev => {
        const next = prev + elapsed * speed
        if (next >= comp.endsAt) { setPlaying(false); return comp.endsAt }
        return next
      })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, comp.endsAt])

  // Visible events up to asOf
  const visibleEvents = useMemo(() =>
    sortedEvents.filter(e => e.timestamp <= asOf),
    [sortedEvents, asOf])

  // Live-computed leaderboard at the current replay time
  const lbAtTime = useMemo(() =>
    leaderboardAt(comp.participants, sortedEvents, asOf),
    [comp.participants, sortedEvents, asOf])

  if (!isOpen) return null

  const duration = Math.max(1, comp.endsAt - comp.startsAt)
  const progress = Math.min(100, Math.max(0, ((asOf - comp.startsAt) / duration) * 100))
  const mmss = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000))
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}>
      <div className="nb-card max-w-3xl w-full flex flex-col"
        style={{ borderColor: 'var(--teal)', borderWidth: 3, boxShadow: '8px 8px 0px #000', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ background: 'var(--teal)', borderBottom: '2px solid #000' }}>
          <div className="flex items-center gap-2 font-black" style={{ color: '#000' }}>
            <Rewind className="w-4 h-4" />
            <span className="tracking-widest">ARENA REPLAY</span>
            <span className="font-normal opacity-60 text-xs">· {comp.name}</span>
          </div>
          <button onClick={onClose} className="nb-btn nb-btn-ghost py-1 px-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body grid: live leaderboard + event stream */}
        <div className="grid grid-cols-2 gap-0 flex-1 overflow-hidden" style={{ minHeight: 320 }}>
          {/* Left: leaderboard as-of */}
          <div className="overflow-y-auto" style={{ borderRight: '2px solid #000' }}>
            <div className="px-3 py-2 text-xs font-black tracking-widest"
              style={{ background: 'var(--surface-2)', color: 'var(--gold)', borderBottom: '2px solid #000' }}>
              🏆 LEADERBOARD @ {mmss(asOf - comp.startsAt)}
            </div>
            {lbAtTime.map((e, i) => {
              const finalRank = finalLeaderboard.find(f => f.userId === e.userId)?.rank ?? 0
              const movedUp = finalRank > 0 && finalRank < e.rank
              return (
                <div key={e.userId} className="flex items-center gap-2 px-3 py-2"
                  style={{ borderBottom: '1px solid var(--border-soft)' }}>
                  <span className="font-black text-xs w-5" style={{
                    color: i === 0 ? 'var(--gold)' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : 'var(--text-muted)',
                  }}>
                    #{e.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs truncate" style={{ color: 'var(--text)' }}>{e.displayName}</div>
                    {movedUp && (
                      <div style={{ fontSize: '9px', color: 'var(--profit)' }}>
                        ↗ moves to #{finalRank} by end
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black" style={{ color: e.totalPnl >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                      {e.totalPnl >= 0 ? '+' : ''}${e.totalPnl.toFixed(2)}
                    </div>
                  </div>
                </div>
              )
            })}
            {lbAtTime.length === 0 && (
              <div className="px-3 py-6 text-center text-xs" style={{ color: 'var(--text-dim)' }}>
                No participants yet
              </div>
            )}
          </div>

          {/* Right: price chart + event stream */}
          <div className="flex flex-col overflow-hidden">
            {/* Mini price chart showing dominant symbol over arena duration */}
            {candles.length > 0 && (() => {
              const W = 300, H = 80, PAD = 6
              const prices = candles.flatMap(c => [c.h, c.l])
              const minP = Math.min(...prices)
              const maxP = Math.max(...prices)
              const range = maxP - minP || 1
              const xFor = (t: number) =>
                PAD + ((t - comp.startsAt) / (comp.endsAt - comp.startsAt)) * (W - PAD * 2)
              const yFor = (p: number) => PAD + (1 - (p - minP) / range) * (H - PAD * 2)
              const currentX = xFor(Math.max(comp.startsAt, Math.min(asOf, comp.endsAt)))
              // Find current price at asOf by picking the nearest candle
              const nearCandle = candles.reduce((best, c) =>
                Math.abs(c.t - asOf) < Math.abs(best.t - asOf) ? c : best, candles[0])
              const currentPriceAtTime = nearCandle.c

              return (
                <div className="shrink-0" style={{ borderBottom: '2px solid #000', background: 'var(--surface)' }}>
                  <div className="flex items-center justify-between px-3 py-1.5 text-xs"
                    style={{ borderBottom: '1px solid var(--border-soft)' }}>
                    <span className="font-black tracking-widest" style={{ color: 'var(--teal)' }}>
                      📈 {dominantSymbol} PRICE
                    </span>
                    <span className="font-mono font-black" style={{ color: 'var(--text)', fontSize: '11px' }}>
                      ${currentPriceAtTime.toFixed(currentPriceAtTime >= 100 ? 2 : 4)}
                    </span>
                  </div>
                  <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none"
                    style={{ display: 'block' }}>
                    {/* Candle wicks + bodies — compact */}
                    {candles.map((c, i) => {
                      const x = xFor(c.t)
                      const isUp = c.c >= c.o
                      const color = isUp ? 'var(--profit)' : 'var(--loss)'
                      const bodyTop = yFor(Math.max(c.o, c.c))
                      const bodyBot = yFor(Math.min(c.o, c.c))
                      return (
                        <g key={`${c.t}-${i}`}>
                          <line x1={x} y1={yFor(c.h)} x2={x} y2={yFor(c.l)}
                            stroke={color} strokeWidth="0.5" opacity="0.7" />
                          <rect x={x - 1} y={bodyTop} width="2" height={Math.max(0.5, bodyBot - bodyTop)}
                            fill={color} opacity="0.7" />
                        </g>
                      )
                    })}

                    {/* Trade event markers along bottom */}
                    {sortedEvents.filter(ev => ev.symbol === dominantSymbol && ev.timestamp <= asOf).map(ev => {
                      const x = xFor(ev.timestamp)
                      const color = ev.action === 'open'
                        ? (ev.side === 'bid' ? 'var(--profit)' : 'var(--loss)')
                        : 'var(--gold)'
                      return (
                        <circle key={ev.id} cx={x} cy={yFor(ev.price)} r="2.5"
                          fill={color} stroke="#000" strokeWidth="0.5" />
                      )
                    })}

                    {/* Playhead — vertical line at current asOf */}
                    <line x1={currentX} y1={PAD} x2={currentX} y2={H - PAD}
                      stroke="var(--teal)" strokeWidth="1.5" strokeDasharray="2,2" />
                    <circle cx={currentX} cy={PAD + 2} r="2" fill="var(--teal)" />
                  </svg>
                </div>
              )
            })()}

          <div className="overflow-y-auto flex flex-col-reverse" style={{ flex: 1, minHeight: 0 }}>
            {visibleEvents.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-xs" style={{ color: 'var(--text-dim)' }}>
                Waiting for first trade...
              </div>
            ) : (
              [...visibleEvents].reverse().map(ev => (
                <div key={ev.id} className="px-3 py-2" style={{ borderBottom: '1px solid var(--border-soft)' }}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-black truncate flex-1" style={{ color: 'var(--text)' }}>{ev.displayName}</span>
                    <span className="text-xs px-1 py-0.5 font-black" style={{
                      background: ev.action === 'open'
                        ? (ev.side === 'bid' ? 'var(--profit)' : 'var(--loss)')
                        : 'var(--border-soft)',
                      color: ev.action === 'open' ? (ev.side === 'bid' ? '#000' : '#fff') : 'var(--text-muted)',
                      border: '1px solid #000', fontSize: '9px',
                    }}>
                      {ev.action === 'open' ? (ev.side === 'bid' ? 'L' : 'S') : 'CL'}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>
                      +{mmss(ev.timestamp - comp.startsAt)}
                    </span>
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {ev.amount} {ev.symbol} · ${ev.price.toFixed(ev.price < 1 ? 6 : 2)} · {ev.leverage}x
                  </div>
                  {ev.pnl !== undefined && (
                    <div className="text-xs font-black mt-0.5" style={{ color: ev.pnl >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                      {ev.pnl >= 0 ? '+' : ''}${ev.pnl.toFixed(2)} USDC
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          </div>
        </div>

        {/* Transport controls */}
        <div className="p-4 shrink-0" style={{ background: 'var(--surface-2)', borderTop: '2px solid #000' }}>
          {/* Timeline bar */}
          <div className="relative h-2 mb-2" style={{ background: '#000', border: '1px solid var(--border-soft)' }}>
            <div className="absolute left-0 top-0 h-full" style={{ width: `${progress}%`, background: 'var(--teal)' }} />
            {/* Event markers */}
            {sortedEvents.map(ev => {
              const pct = ((ev.timestamp - comp.startsAt) / duration) * 100
              const color = ev.action === 'open'
                ? (ev.side === 'bid' ? 'var(--profit)' : 'var(--loss)')
                : 'var(--gold)'
              return (
                <div key={ev.id} className="absolute top-0 h-full w-0.5"
                  style={{ left: `${pct}%`, background: color, opacity: 0.6 }}
                  title={`${ev.displayName} · ${ev.action} ${ev.symbol}`} />
              )
            })}
            <input
              type="range" min={comp.startsAt} max={comp.endsAt} step="100"
              value={asOf}
              onChange={e => { setPlaying(false); setAsOf(Number(e.target.value)) }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            <span className="font-mono">{mmss(asOf - comp.startsAt)}</span>
            <span>{visibleEvents.length} / {sortedEvents.length} events</span>
            <span className="font-mono">{mmss(duration)}</span>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => { setPlaying(false); setAsOf(comp.startsAt) }}
              className="nb-btn nb-btn-ghost py-1.5 px-2">
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setPlaying(p => !p)}
              className="nb-btn nb-btn-primary py-2 px-5 text-sm flex items-center gap-1.5">
              {playing ? <><Pause className="w-4 h-4" /> PAUSE</> : <><Play className="w-4 h-4" /> PLAY</>}
            </button>
            <button onClick={() => { setPlaying(false); setAsOf(comp.endsAt) }}
              className="nb-btn nb-btn-ghost py-1.5 px-2">
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            <div className="ml-auto flex items-center gap-1 text-xs">
              <span style={{ color: 'var(--text-muted)' }}>SPEED</span>
              {SPEEDS.map(s => (
                <button key={s} onClick={() => setSpeed(s)}
                  className="py-1 px-1.5 text-xs font-black"
                  style={{
                    background: speed === s ? 'var(--teal)' : 'var(--surface)',
                    color: speed === s ? '#000' : 'var(--text-muted)',
                    border: '1px solid #000', fontSize: '10px',
                  }}>
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
