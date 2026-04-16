'use client'
import { useState, useEffect, useCallback, use, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Trophy, TrendingUp, TrendingDown, Clock, ArrowLeft, Zap,
  Activity, Wifi, WifiOff, BarChart2, Globe, Waves,
} from 'lucide-react'
import { Competition, LeaderboardEntry, TradeEvent, Position } from '@/lib/types'
import WalletButton from '@/components/WalletButton'
import { usePacificaWs } from '@/lib/pacificaWs'

const SYMBOLS = ['BTC', 'ETH', 'SOL', 'WIF', 'BONK']

// ── Helpers ───────────────────────────────────────────────────────────────────

function liqPrice(pos: Position): number {
  const factor = 0.95 / pos.leverage
  return pos.side === 'bid'
    ? pos.entryPrice * (1 - factor)
    : pos.entryPrice * (1 + factor)
}

function posHealth(pos: Position, currentPrice: number): number {
  const liq = liqPrice(pos)
  if (pos.side === 'bid') {
    const range = pos.entryPrice - liq
    return range <= 0 ? 1 : Math.max(0, Math.min(1, (currentPrice - liq) / range))
  }
  const range = liq - pos.entryPrice
  return range <= 0 ? 1 : Math.max(0, Math.min(1, (liq - currentPrice) / range))
}

function fmtPrice(n: number, sym: string): string {
  if (sym === 'BONK') return n.toFixed(9)
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return n.toFixed(4)
}

function fmtBig(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toFixed(2)
}

function pnlClass(v: number) { return v >= 0 ? 'profit' : 'loss' }
function pnlPrefix(v: number) { return v >= 0 ? '+' : '' }

// ── SSE hook ──────────────────────────────────────────────────────────────────

interface SsePayload { type: 'competition' | 'feed' | 'prices' | 'error'; data: unknown }

function useCompetitionStream(id: string) {
  const [comp, setComp] = useState<Competition | null>(null)
  const [feed, setFeed] = useState<TradeEvent[]>([])
  const [restPrices, setRestPrices] = useState<Record<string, number>>({})
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const esRef = useRef<EventSource | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const [connected, setConnected] = useState(false)

  const fetchLeaderboard = useCallback((prices: Record<string, number>) => {
    fetch(`/api/leaderboard/${id}?prices=${encodeURIComponent(JSON.stringify(prices))}`)
      .then(r => r.json()).then(d => setLeaderboard(d.entries ?? [])).catch(() => {})
  }, [id])

  const pollRest = useCallback(async () => {
    const [compRes, priceRes, feedRes] = await Promise.all([
      fetch(`/api/competitions/${id}`).then(r => r.json()).catch(() => null),
      fetch('/api/prices').then(r => r.json()).catch(() => ({})),
      fetch(`/api/feed/${id}`).then(r => r.json()).catch(() => []),
    ])
    if (compRes) setComp(compRes)
    if (priceRes) setRestPrices(priceRes)
    if (feedRes) setFeed(feedRes)
    fetchLeaderboard(priceRes ?? {})
  }, [id, fetchLeaderboard])

  useEffect(() => {
    try {
      const es = new EventSource(`/api/competitions/${id}/stream`)
      esRef.current = es
      es.onopen = () => { setConnected(true); clearInterval(pollingRef.current) }
      es.onmessage = (e) => {
        try {
          const msg: SsePayload = JSON.parse(e.data)
          if (msg.type === 'competition') setComp(msg.data as Competition)
          if (msg.type === 'feed') setFeed(msg.data as TradeEvent[])
          if (msg.type === 'prices') {
            const prices = msg.data as Record<string, number>
            setRestPrices(prices)
            fetchLeaderboard(prices)
          }
        } catch { /* ignore */ }
      }
      es.onerror = () => {
        setConnected(false); es.close()
        pollRest()
        pollingRef.current = setInterval(pollRest, 3000)
      }
    } catch {
      pollRest()
      pollingRef.current = setInterval(pollRest, 3000)
    }
    return () => { esRef.current?.close(); clearInterval(pollingRef.current) }
  }, [id, pollRest, fetchLeaderboard])

  return { comp, feed, restPrices, leaderboard, sseConnected: connected }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ArenaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const { comp, feed, restPrices, leaderboard, sseConnected } = useCompetitionStream(id)
  const { tickers, wsConnected } = usePacificaWs()

  const [settled, setSettled] = useState(false)
  const [winner, setWinner] = useState<LeaderboardEntry | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)

  const [symbol, setSymbol] = useState('BTC')
  const [side, setSide] = useState<'bid' | 'ask'>('bid')
  const [amount, setAmount] = useState('0.01')
  const [leverage, setLeverage] = useState(5)
  const [tradeLoading, setTradeLoading] = useState(false)
  const [tradeMsg, setTradeMsg] = useState('')
  const [lastPacificaId, setLastPacificaId] = useState<string | null>(null)

  const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') ?? '' : ''
  const displayName = typeof window !== 'undefined' ? localStorage.getItem('displayName') ?? 'Anon' : 'Anon'

  const prices = useMemo(() => {
    const p: Record<string, number> = { ...restPrices }
    for (const [wsKey, ticker] of Object.entries(tickers)) {
      const sym = wsKey.replace('-PERP', '').replace('-perp', '')
      if (SYMBOLS.includes(sym)) {
        const price = ticker.markPrice || ticker.lastPrice
        if (price > 0) p[sym] = price
      }
    }
    return p
  }, [restPrices, tickers])

  const currentTicker = tickers[`${symbol}-PERP`] ?? tickers[symbol] ?? null

  const triggerSettle = useCallback(async (settlePrices: Record<string, number>) => {
    if (settled) return
    setSettled(true)
    try {
      const res = await fetch(`/api/competitions/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'settle', prices: settlePrices }),
      })
      const data = await res.json()
      if (data.final?.length > 0) setWinner(data.final[0])
    } catch { /* ignore */ }
  }, [id, settled])

  useEffect(() => {
    if (comp?.status === 'ended' && !settled) triggerSettle(prices)
  }, [comp?.status, settled, prices, triggerSettle])

  useEffect(() => {
    if (!comp) return
    const tick = () => setTimeLeft(Math.max(0, comp.endsAt - Date.now()))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [comp])

  async function handleTrade(action: 'open' | 'close', clientOrderId?: string) {
    setTradeLoading(true)
    setTradeMsg('')
    try {
      const currentPrice = prices[symbol] ?? 0
      const res = await fetch(`/api/competitions/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action, userId, displayName, symbol, side,
          amount: parseFloat(amount), leverage, clientOrderId, currentPrice,
        }),
      })
      const data = await res.json()
      if (data.success) {
        if (action === 'open') {
          const onChain = data.pacifica?.success
          setLastPacificaId(data.pacifica?.orderId ?? null)
          setTradeMsg(onChain
            ? `✅ Opened on Pacifica (${data.pacifica.orderId?.slice(0, 10)}...)`
            : '✅ Position opened (virtual)')
        } else {
          setTradeMsg(`✅ Closed! PnL: ${pnlPrefix(data.pnl)}$${Math.abs(data.pnl ?? 0).toFixed(2)}`)
        }
      } else {
        setTradeMsg(`❌ ${data.error}`)
      }
    } finally {
      setTradeLoading(false)
      setTimeout(() => setTradeMsg(''), 5000)
    }
  }

  const myEntry = leaderboard.find(e => e.userId === userId)
  const myPositions: Position[] = comp?.participants?.[userId]?.positions ?? []
  const isEnded = comp?.status === 'ended'
  const minutes = Math.floor(timeLeft / 60000)
  const seconds = Math.floor((timeLeft % 60000) / 1000)

  if (!comp) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="nb-card px-8 py-6 text-center">
        <Waves className="w-8 h-8 mx-auto mb-3 animate-pulse" style={{ color: 'var(--teal)' }} />
        <div className="font-black text-sm tracking-widest" style={{ color: 'var(--teal)' }}>LOADING ARENA...</div>
      </div>
    </div>
  )

  // ── Winner screen ─────────────────────────────────────────────────────────
  if (isEnded && winner && leaderboard.length > 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8" style={{ background: 'var(--bg)' }}>
        <div className="max-w-lg w-full">
          <div className="nb-card p-8 text-center mb-4" style={{ borderColor: 'var(--gold)', boxShadow: '6px 6px 0px #000' }}>
            <div className="text-6xl mb-3">🏆</div>
            <div className="text-xs font-black tracking-[0.3em] mb-1" style={{ color: 'var(--gold)' }}>COMPETITION OVER</div>
            <h1 className="text-3xl font-black mb-1">{comp.name}</h1>
            <div className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Final Results</div>

            <div className="p-5 mb-4" style={{ background: 'var(--surface-2)', border: '2px solid var(--gold)', boxShadow: '4px 4px 0px #000' }}>
              <div className="text-xs font-black tracking-wider mb-1" style={{ color: 'var(--gold)' }}>WINNER</div>
              <div className="text-2xl font-black text-white mb-1">{winner.displayName}</div>
              <div className="text-3xl font-black" style={{ color: winner.totalPnl >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                {pnlPrefix(winner.totalPnl)}{winner.totalPnl.toFixed(2)} USDC
              </div>
              <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{winner.roi.toFixed(2)}% ROI</div>
            </div>

            <div className="nb-card overflow-hidden mb-4">
              {leaderboard.map((e, i) => (
                <div key={e.userId} className="flex items-center gap-3 px-4 py-3"
                  style={{
                    borderBottom: i < leaderboard.length - 1 ? '2px solid #000' : undefined,
                    background: e.userId === userId ? 'rgba(0,200,224,0.08)' : undefined,
                  }}>
                  <span className="font-black w-6 text-center" style={{
                    color: i === 0 ? 'var(--gold)' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : 'var(--text-muted)',
                  }}>#{e.rank}</span>
                  <span className="flex-1 font-bold text-sm truncate">{e.displayName}</span>
                  <span className="font-black text-sm" style={{ color: e.totalPnl >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                    {pnlPrefix(e.totalPnl)}{e.totalPnl.toFixed(2)}
                  </span>
                  <span className="text-xs w-14 text-right" style={{ color: 'var(--text-muted)' }}>{e.roi.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => router.push('/leaderboard')} className="nb-btn nb-btn-ghost flex-1 py-3">
              <Globe className="w-4 h-4" /> Hall of Fame
            </button>
            <button onClick={() => router.push('/')} className="nb-btn nb-btn-ghost flex-1 py-3">
              Home
            </button>
            <button
              onClick={async () => {
                const res = await fetch('/api/competitions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: `${comp.name} Rematch`, creatorId: userId, durationMinutes: comp.durationMinutes }),
                })
                const newComp = await res.json()
                await fetch(`/api/competitions/${newComp.id}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId, displayName }),
                })
                router.push(`/arena/${newComp.id}`)
              }}
              className="nb-btn nb-btn-primary flex-1 py-3"
            >
              🔄 REMATCH
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main Arena UI ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col text-white" style={{ background: 'var(--bg)' }}>

      {/* Header */}
      <header style={{ background: 'var(--surface)', borderBottom: '2px solid #000', boxShadow: '0 2px 0px #000' }}
        className="px-4 py-2 flex items-center gap-3 sticky top-0 z-50">
        <button onClick={() => router.push('/')} className="nb-btn nb-btn-ghost py-1 px-2">
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-center gap-2">
          <Waves className="w-4 h-4" style={{ color: 'var(--teal)' }} />
          <span className="font-black text-xs tracking-tight" style={{ color: 'var(--teal)' }}>TIDAL</span>
          <span className="font-black text-xs">WARS</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-black text-sm text-white truncate">{comp.name}</h1>
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>{Object.keys(comp.participants ?? {}).length} traders</span>
            <span style={{
              color: isEnded ? 'var(--loss)' : 'var(--profit)',
              fontFamily: 'monospace',
              fontWeight: 800,
            }}>
              {isEnded ? '◼ ENDED' : `▶ ${minutes}:${seconds.toString().padStart(2, '0')}`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {myEntry && (
            <div className="text-right text-xs pr-2" style={{ borderRight: '2px solid #1a2535' }}>
              <div className="font-black" style={{ color: myEntry.totalPnl >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                {pnlPrefix(myEntry.totalPnl)}{myEntry.totalPnl.toFixed(2)}
              </div>
              <div style={{ color: 'var(--text-muted)' }}>#{myEntry.rank}</div>
            </div>
          )}
          <div className="flex items-center gap-1">
            <span className={`flex items-center gap-0.5 text-xs ${wsConnected ? '' : ''}`}
              style={{ color: wsConnected ? 'var(--teal)' : 'var(--text-muted)' }} title="Pacifica WebSocket">
              {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            </span>
            <span className="text-xs" style={{ color: sseConnected ? 'var(--profit)' : 'var(--text-muted)' }} title="SSE stream">
              <Activity className="w-3 h-3" />
            </span>
          </div>
          {lastPacificaId && (
            <span className="text-xs hidden lg:flex items-center gap-1" style={{ color: 'var(--teal)' }} title={`Pacifica: ${lastPacificaId}`}>
              <Zap className="w-3 h-3" /> on-chain
            </span>
          )}
          <WalletButton />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Leaderboard ─────────────────────────────────────────── */}
        <div className="w-52 flex flex-col" style={{ borderRight: '2px solid #000' }}>
          <div className="flex items-center gap-2 px-3 py-2.5 text-xs font-black tracking-widest uppercase"
            style={{ borderBottom: '2px solid #000', background: 'var(--surface)', color: 'var(--gold)' }}>
            <Trophy className="w-3.5 h-3.5" /> Leaderboard
          </div>
          <div className="flex-1 overflow-y-auto">
            {leaderboard.length === 0 ? (
              <div className="text-center text-xs py-8" style={{ color: 'var(--text-dim)' }}>No traders yet</div>
            ) : (
              leaderboard.map((entry, i) => (
                <div key={entry.userId} className="px-3 py-2"
                  style={{
                    borderBottom: '2px solid #000',
                    background: entry.userId === userId ? 'rgba(0,200,224,0.06)' : undefined,
                    borderLeft: entry.userId === userId ? '3px solid var(--teal)' : undefined,
                  }}>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-xs w-4" style={{
                      color: i === 0 ? 'var(--gold)' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : 'var(--text-muted)',
                    }}>#{entry.rank}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate">{entry.displayName}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{entry.positionCount} open</div>
                    </div>
                  </div>
                  <div className="text-xs font-black mt-0.5" style={{ color: entry.totalPnl >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                    {pnlPrefix(entry.totalPnl)}{entry.totalPnl.toFixed(2)}
                    <span className="font-normal ml-1" style={{ color: 'var(--text-muted)' }}>({entry.roi.toFixed(1)}%)</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <button onClick={() => router.push('/leaderboard')}
            className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-black tracking-wider"
            style={{ borderTop: '2px solid #000', background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
            <Globe className="w-3 h-3" /> HALL OF FAME
          </button>
        </div>

        {/* ── Center: Trade Panel ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Symbol selector + price bar */}
          <div className="flex gap-0 px-0 py-0 overflow-x-auto" style={{ borderBottom: '2px solid #000' }}>
            {SYMBOLS.map(sym => {
              const ticker = tickers[`${sym}-PERP`] ?? tickers[sym]
              const price = prices[sym]
              const isSelected = symbol === sym
              const change24h = ticker?.change24h ?? 0
              const fr = ticker?.fundingRate ?? 0

              return (
                <button key={sym} onClick={() => setSymbol(sym)}
                  className="flex flex-col items-start px-3 py-2 text-left min-w-[80px] flex-shrink-0 transition-all"
                  style={{
                    background: isSelected ? 'var(--teal)' : 'var(--surface)',
                    color: isSelected ? '#000' : 'white',
                    borderRight: '2px solid #000',
                    borderBottom: isSelected ? '2px solid var(--teal)' : undefined,
                  }}>
                  <div className="flex items-center gap-1">
                    <span className="font-black text-xs">{sym}</span>
                    {change24h !== 0 && (
                      <span className="text-xs" style={{ color: isSelected ? '#000' : (change24h >= 0 ? 'var(--profit)' : 'var(--loss)') }}>
                        {change24h >= 0 ? '▲' : '▼'}{Math.abs(change24h).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono font-bold">
                    {price != null ? `$${fmtPrice(price, sym)}` : '—'}
                  </span>
                  {fr !== 0 && (
                    <span className="text-xs" style={{ color: isSelected ? '#000' : (fr >= 0 ? 'var(--profit)' : 'var(--loss)'), opacity: 0.8 }}>
                      FR{fr >= 0 ? '+' : ''}{(fr * 100).toFixed(4)}%
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Market stats row */}
          {currentTicker && (currentTicker.openInterest > 0 || currentTicker.volume24h > 0) && (
            <div className="flex gap-4 px-4 py-1.5 text-xs overflow-x-auto"
              style={{ borderBottom: '2px solid #000', background: 'var(--surface-2)' }}>
              {currentTicker.markPrice > 0 && (
                <span style={{ color: 'var(--text-muted)' }}>Mark <span className="text-white font-bold">${fmtPrice(currentTicker.markPrice, symbol)}</span></span>
              )}
              {currentTicker.indexPrice > 0 && (
                <span style={{ color: 'var(--text-muted)' }}>Index <span className="text-white font-bold">${fmtPrice(currentTicker.indexPrice, symbol)}</span></span>
              )}
              {currentTicker.openInterest > 0 && (
                <span style={{ color: 'var(--text-muted)' }}>OI <span className="text-white font-bold">${fmtBig(currentTicker.openInterest)}</span></span>
              )}
              {currentTicker.volume24h > 0 && (
                <span style={{ color: 'var(--text-muted)' }}>24h Vol <span className="text-white font-bold">${fmtBig(currentTicker.volume24h)}</span></span>
              )}
              {currentTicker.fundingRate !== 0 && (
                <span style={{ color: 'var(--text-muted)' }}>Funding{' '}
                  <span className="font-bold" style={{ color: currentTicker.fundingRate >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                    {currentTicker.fundingRate >= 0 ? '+' : ''}{(currentTicker.fundingRate * 100).toFixed(4)}%/8h
                  </span>
                </span>
              )}
            </div>
          )}

          {/* Trade form */}
          {!isEnded ? (
            <div className="p-4" style={{ borderBottom: '2px solid #000' }}>
              {/* Long / Short */}
              <div className="grid grid-cols-2 gap-0 mb-3" style={{ border: '2px solid #000', boxShadow: 'var(--nb-shadow-sm)' }}>
                <button onClick={() => setSide('bid')}
                  className="py-2.5 font-black text-sm flex items-center justify-center gap-1.5 transition-colors"
                  style={{
                    background: side === 'bid' ? 'var(--profit)' : 'var(--surface)',
                    color: side === 'bid' ? '#000' : 'var(--text-muted)',
                    borderRight: '2px solid #000',
                  }}>
                  <TrendingUp className="w-3.5 h-3.5" /> LONG
                </button>
                <button onClick={() => setSide('ask')}
                  className="py-2.5 font-black text-sm flex items-center justify-center gap-1.5 transition-colors"
                  style={{
                    background: side === 'ask' ? 'var(--loss)' : 'var(--surface)',
                    color: side === 'ask' ? '#fff' : 'var(--text-muted)',
                  }}>
                  <TrendingDown className="w-3.5 h-3.5" /> SHORT
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-black mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Amount ({symbol})
                  </label>
                  <input type="number" step="0.001" min="0.001"
                    className="nb-input" value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-black mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Leverage: <span style={{ color: 'var(--teal)' }}>{leverage}x</span>
                  </label>
                  <input type="range" min={1} max={comp.maxLeverage} step={1}
                    className="w-full mt-2" value={leverage} onChange={e => setLeverage(Number(e.target.value))} />
                </div>
              </div>

              {/* Order info */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                <span>Notional <span className="font-bold text-white">
                  ${((prices[symbol] ?? 0) * parseFloat(amount || '0') * leverage).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span></span>
                <span>Margin <span className="font-bold text-white">
                  ${((prices[symbol] ?? 0) * parseFloat(amount || '0') / leverage).toFixed(2)}
                </span></span>
                {currentTicker?.fundingRate !== undefined && currentTicker.fundingRate !== 0 && (
                  <span>Funding <span className="font-bold" style={{ color: currentTicker.fundingRate >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                    {currentTicker.fundingRate >= 0 ? '+' : ''}{(currentTicker.fundingRate * 100).toFixed(4)}%/8h
                  </span></span>
                )}
              </div>

              <button onClick={() => handleTrade('open')} disabled={tradeLoading || !userId}
                className="nb-btn w-full py-3 text-sm"
                style={{
                  background: side === 'bid' ? 'var(--profit)' : 'var(--loss)',
                  color: side === 'bid' ? '#000' : '#fff',
                  border: '2px solid #000',
                  boxShadow: 'var(--nb-shadow)',
                }}>
                {tradeLoading ? '...' : `${side === 'bid' ? '▲ LONG' : '▼ SHORT'} ${symbol} ${leverage}x`}
              </button>

              {tradeMsg && (
                <div className="mt-2 text-xs text-center py-1.5 px-3 font-bold"
                  style={{ background: 'var(--surface-2)', border: '2px solid #000' }}>
                  {tradeMsg}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center" style={{ borderBottom: '2px solid #000' }}>
              <Clock className="w-6 h-6 mx-auto mb-1.5 opacity-30" />
              <p className="text-xs font-black tracking-widest" style={{ color: 'var(--text-muted)' }}>COMPETITION ENDED</p>
            </div>
          )}

          {/* Open Positions */}
          {myPositions.length > 0 && (
            <div className="p-4 overflow-y-auto flex-1">
              <div className="text-xs font-black tracking-widest uppercase mb-3" style={{ color: 'var(--teal)' }}>
                My Positions ({myPositions.length})
              </div>
              <div className="space-y-2">
                {myPositions.map(pos => {
                  const cur = prices[pos.symbol] ?? pos.entryPrice
                  const priceDiff = pos.side === 'bid' ? cur - pos.entryPrice : pos.entryPrice - cur
                  const upnl = priceDiff * pos.amount * pos.leverage
                  const liq = liqPrice(pos)
                  const health = posHealth(pos, cur)
                  const healthBg = health > 0.5 ? 'var(--profit)' : health > 0.25 ? 'var(--gold)' : 'var(--loss)'
                  const distPct = pos.side === 'bid'
                    ? ((cur - liq) / liq * 100)
                    : ((liq - cur) / liq * 100)

                  return (
                    <div key={pos.clientOrderId} className="p-3"
                      style={{ background: 'var(--surface-2)', border: '2px solid #000', boxShadow: 'var(--nb-shadow-sm)' }}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-sm font-black">{pos.symbol}</span>
                            <span className="text-xs px-1.5 py-0.5 font-black" style={{
                              background: pos.side === 'bid' ? 'var(--profit)' : 'var(--loss)',
                              color: pos.side === 'bid' ? '#000' : '#fff',
                              border: '1px solid #000',
                            }}>
                              {pos.side === 'bid' ? 'LONG' : 'SHORT'} {pos.leverage}x
                            </span>
                          </div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {pos.amount} @ ${fmtPrice(pos.entryPrice, pos.symbol)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-black text-right" style={{ color: upnl >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                            {pnlPrefix(upnl)}{upnl.toFixed(2)}
                          </div>
                          {!isEnded && (
                            <button onClick={() => handleTrade('close', pos.clientOrderId)}
                              className="nb-btn nb-btn-ghost text-xs py-1 px-2">
                              CLOSE
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Health bar */}
                      <div>
                        <div className="h-2 mb-1" style={{ background: '#000', border: '1px solid #000' }}>
                          <div className="h-full transition-all" style={{ width: `${Math.max(2, health * 100)}%`, background: healthBg }} />
                        </div>
                        <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                          <span>Liq: ${fmtPrice(liq, pos.symbol)}</span>
                          <span style={{ color: health < 0.25 ? 'var(--loss)' : undefined }}>
                            {distPct.toFixed(1)}% away
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {myPositions.length === 0 && !isEnded && (
            <div className="flex-1 flex items-center justify-center text-xs font-black tracking-widest" style={{ color: 'var(--text-dim)' }}>
              NO OPEN POSITIONS
            </div>
          )}
        </div>

        {/* ── Right: Live Feed ──────────────────────────────────────────── */}
        <div className="w-56 flex flex-col" style={{ borderLeft: '2px solid #000' }}>
          <div className="flex items-center justify-between px-3 py-2.5"
            style={{ borderBottom: '2px solid #000', background: 'var(--surface)' }}>
            <div className="flex items-center gap-1.5">
              <span className="live-dot-teal" />
              <span className="text-xs font-black tracking-widest uppercase" style={{ color: 'var(--teal)' }}>Live Feed</span>
            </div>
            <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{feed.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {feed.length === 0 ? (
              <div className="text-center py-10">
                <BarChart2 className="w-5 h-5 mx-auto mb-2 opacity-20" style={{ color: 'var(--teal)' }} />
                <div className="text-xs font-black tracking-widest" style={{ color: 'var(--text-dim)' }}>WAITING...</div>
              </div>
            ) : (
              feed.map(event => (
                <div key={event.id} className="px-3 py-2" style={{ borderBottom: '2px solid #000' }}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-black text-white truncate flex-1">{event.displayName}</span>
                    <span className="text-xs px-1 py-0.5 font-black" style={{
                      background: event.action === 'open'
                        ? (event.side === 'bid' ? 'var(--profit)' : 'var(--loss)')
                        : '#1a2535',
                      color: event.action === 'open' ? (event.side === 'bid' ? '#000' : '#fff') : 'var(--text-muted)',
                      border: '1px solid #000',
                      fontSize: '10px',
                    }}>
                      {event.action === 'open' ? (event.side === 'bid' ? 'L' : 'S') : 'CL'}
                    </span>
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {event.amount} {event.symbol} · ${fmtPrice(event.price, event.symbol)} · {event.leverage}x
                  </div>
                  {event.pnl !== undefined && (
                    <div className="text-xs font-black mt-0.5" style={{ color: event.pnl >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                      {pnlPrefix(event.pnl)}{event.pnl.toFixed(2)} USDC
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
                      {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    {event.pacificaOrderId && (
                      <span className="text-xs flex items-center gap-0.5" style={{ color: 'var(--teal)' }}
                        title={`Pacifica: ${event.pacificaOrderId}`}>
                        <Zap className="w-2.5 h-2.5" /> ⬡
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
