'use client'
import { useState, useEffect, useCallback, use, useMemo, useRef, memo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Trophy, TrendingUp, TrendingDown, Clock, ArrowLeft, Zap,
  Activity, Wifi, WifiOff, BarChart2, Globe, Waves, Sparkles,
  MessageCircle, Send, ExternalLink, Copy,
} from 'lucide-react'
import { Competition, LeaderboardEntry, TradeEvent, Position } from '@/lib/types'
import WalletButton from '@/components/WalletButton'
import SigningModal from '@/components/SigningModal'
import { CandleChart } from '@/components/CandleChart'
import { usePacificaWs } from '@/lib/pacificaWs'
import type { TrendingToken } from '@/lib/elfa'
import type { ChatMessage } from '@/lib/chat'
import { ACHIEVEMENTS, loadUnlocked, saveUnlocked, type Achievement } from '@/lib/achievements'
import { captainFor } from '@/lib/points'

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

// Ocean rank based on ROI %
function oceanRank(roi: number): { emoji: string; title: string } {
  if (roi >= 10)  return { emoji: '🐙', title: 'KRAKEN' }
  if (roi >= 5)   return { emoji: '🐋', title: 'WHALE' }
  if (roi >= 2)   return { emoji: '🦈', title: 'SHARK' }
  if (roi >= 0.5) return { emoji: '🐬', title: 'DOLPHIN' }
  if (roi >= 0)   return { emoji: '🐟', title: 'FISH' }
  if (roi >= -2)  return { emoji: '🦀', title: 'CRAB' }
  if (roi >= -5)  return { emoji: '🦐', title: 'SHRIMP' }
  return            { emoji: '🪸', title: 'REEF' }
}

// ── Price history hook ────────────────────────────────────────────────────────

const MAX_TICKS = 80

interface PriceTick { t: number; p: number }

function usePriceHistory(prices: Record<string, number>, symbol: string) {
  const historyRef = useRef<Record<string, PriceTick[]>>({})
  const pricesRef  = useRef(prices)
  const [snap, setSnap] = useState<PriceTick[]>([])

  useEffect(() => { pricesRef.current = prices }, [prices])

  const addTick = useCallback((sym: string, price: number | undefined) => {
    if (!price || price <= 0) return
    let arr = historyRef.current[sym]
    if (!arr) {
      // First price for this symbol: seed 2 identical ticks so chart renders immediately
      const now = Date.now()
      arr = [{ t: now - 1500, p: price }, { t: now, p: price }]
      historyRef.current[sym] = arr
      setSnap([...arr])
      return
    }
    const last = arr[arr.length - 1]
    if (last && last.p === price && Date.now() - last.t < 1500) return
    arr.push({ t: Date.now(), p: price })
    if (arr.length > MAX_TICKS) arr.shift()
    setSnap([...arr])
  }, [])

  // Sync snapshot when symbol changes (show existing history if any)
  useEffect(() => {
    const existing = historyRef.current[symbol]
    if (existing) setSnap([...existing])
    else setSnap([])
    addTick(symbol, prices[symbol])
  }, [symbol, prices, addTick])

  // Force-tick every 2s to keep chart fresh even when prices are static
  useEffect(() => {
    const interval = setInterval(() => {
      addTick(symbol, pricesRef.current[symbol])
    }, 2000)
    return () => clearInterval(interval)
  }, [symbol, addTick])

  return snap
}

// ── Tide Gauge (ocean-themed price + position visual) ─────────────────────────

function tideLabel(pct: number): { label: string; emoji: string; color: string } {
  if (pct >= 5)  return { label: 'TSUNAMI',    emoji: '🌊🌊', color: 'var(--profit)' }
  if (pct >= 2)  return { label: 'HIGH TIDE',  emoji: '🌊',   color: 'var(--profit)' }
  if (pct >= 0.5) return { label: 'RISING',    emoji: '🐟',   color: 'var(--profit)' }
  if (pct > -0.5) return { label: 'CALM SEA',  emoji: '⛵',   color: 'var(--teal)'   }
  if (pct > -2)  return { label: 'EBBING',     emoji: '🦀',   color: 'var(--loss)'   }
  if (pct > -5)  return { label: 'LOW TIDE',   emoji: '🪸',   color: 'var(--loss)'   }
  return               { label: 'SHIPWRECK',   emoji: '☠️',   color: 'var(--loss)'   }
}

const TideGauge = memo(function TideGauge({
  ticks, symbol, entryPrices, currentPrice,
}: {
  ticks: PriceTick[]
  symbol: string
  entryPrices: { price: number; side: 'bid' | 'ask' }[]
  currentPrice: number
}) {
  const firstP = ticks[0]?.p ?? currentPrice
  const lastP  = currentPrice || ticks[ticks.length - 1]?.p || 0
  const sessionChangePct = firstP > 0 ? ((lastP - firstP) / firstP) * 100 : 0
  const tide = tideLabel(sessionChangePct)

  // Session high/low since arena opened
  const sessionPrices = ticks.map(t => t.p)
  const sessionHigh = sessionPrices.length ? Math.max(...sessionPrices, lastP) : lastP
  const sessionLow  = sessionPrices.length ? Math.min(...sessionPrices, lastP) : lastP

  // Best position for this symbol (if any)
  const myBest = entryPrices[0]
  let posPnlPct = 0
  if (myBest && myBest.price > 0) {
    posPnlPct = myBest.side === 'bid'
      ? ((lastP - myBest.price) / myBest.price) * 100
      : ((myBest.price - lastP) / myBest.price) * 100
  }

  // DYNAMIC wave — amplitude, speed, baseline driven by session change
  const absPct = Math.abs(sessionChangePct)
  const amplitude = Math.min(35, 8 + absPct * 3)             // 8-35 px — bigger swings = bigger waves
  const waveDur = Math.max(1.8, 6 - absPct * 0.4).toFixed(1) // 6s → 1.8s — more volatile = faster
  const baseline = sessionChangePct >= 0 ? 55 - Math.min(15, absPct * 2) : 65 + Math.min(15, absPct * 2)
  const topA = (baseline - amplitude).toFixed(1)
  const botA = (baseline + amplitude).toFixed(1)
  const midA = baseline.toFixed(1)

  // Also render a second wave layer offset for depth
  const amp2 = amplitude * 0.6
  const top2 = (baseline - amp2).toFixed(1)
  const bot2 = (baseline + amp2).toFixed(1)

  return (
    <div style={{ borderBottom: '2px solid #000', background: 'var(--surface-2)', position: 'relative', overflow: 'hidden' }}>
      {/* DEEP ocean gradient background */}
      <div className="absolute inset-0" style={{
        background: `linear-gradient(180deg, var(--surface-3) 0%, var(--surface-2) 100%)`,
        pointerEvents: 'none',
      }} />

      {/* Far wave (slow, less opacity) */}
      <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" style={{ opacity: 0.12, pointerEvents: 'none' }}>
        <defs>
          <linearGradient id={`wave-far-${symbol}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={tide.color} stopOpacity="0.5" />
            <stop offset="1" stopColor={tide.color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path fill={`url(#wave-far-${symbol})`}>
          <animate attributeName="d" dur={`${Number(waveDur) * 1.4}s`} repeatCount="indefinite"
            values={`M0,${midA} Q50,${top2} 100,${midA} T200,${midA} T300,${midA} T400,${midA} L400,100 L0,100 Z;
                     M0,${midA} Q50,${bot2} 100,${midA} T200,${midA} T300,${midA} T400,${midA} L400,100 L0,100 Z;
                     M0,${midA} Q50,${top2} 100,${midA} T200,${midA} T300,${midA} T400,${midA} L400,100 L0,100 Z`} />
        </path>
      </svg>

      {/* Near wave (fast, stronger opacity) */}
      <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" style={{ opacity: 0.22, pointerEvents: 'none' }}>
        <defs>
          <linearGradient id={`wave-near-${symbol}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={tide.color} stopOpacity="0.8" />
            <stop offset="1" stopColor={tide.color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path fill={`url(#wave-near-${symbol})`}>
          <animate attributeName="d" dur={`${waveDur}s`} repeatCount="indefinite"
            values={`M0,${midA} Q50,${topA} 100,${midA} T200,${midA} T300,${midA} T400,${midA} L400,100 L0,100 Z;
                     M0,${midA} Q50,${botA} 100,${midA} T200,${midA} T300,${midA} T400,${midA} L400,100 L0,100 Z;
                     M0,${midA} Q50,${topA} 100,${midA} T200,${midA} T300,${midA} T400,${midA} L400,100 L0,100 Z`} />
        </path>
      </svg>

      <div className="relative px-4 py-3">
        {/* Symbol + price + tide label */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-wider" style={{ color: 'var(--teal)' }}>🌊 {symbol}</span>
              <span className="text-xs font-bold px-1.5 py-0.5" style={{
                background: tide.color, color: '#000', border: '1px solid #000',
                boxShadow: '2px 2px 0px #000', fontSize: '9px',
              }}>
                {tide.emoji} {tide.label}
              </span>
            </div>
            <div className="text-xl font-black mt-1 font-mono" style={{ color: 'var(--text)' }}>
              ${fmtPrice(lastP, symbol)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>SESSION</div>
            <div className="text-sm font-black" style={{ color: tide.color }}>
              {sessionChangePct >= 0 ? '▲' : '▼'}{Math.abs(sessionChangePct).toFixed(2)}%
            </div>
          </div>
        </div>

        {/* High / Low row */}
        <div className="grid grid-cols-3 gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <div>
            <div style={{ fontSize: '10px' }}>HIGH</div>
            <div className="font-mono font-bold" style={{ color: 'var(--profit)' }}>${fmtPrice(sessionHigh, symbol)}</div>
          </div>
          <div>
            <div style={{ fontSize: '10px' }}>LOW</div>
            <div className="font-mono font-bold" style={{ color: 'var(--loss)' }}>${fmtPrice(sessionLow, symbol)}</div>
          </div>
          {myBest ? (
            <div>
              <div style={{ fontSize: '10px' }}>YOUR POS</div>
              <div className="font-mono font-bold" style={{ color: posPnlPct >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                {posPnlPct >= 0 ? '+' : ''}{posPnlPct.toFixed(2)}%
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '10px' }}>TICKS</div>
              <div className="font-mono font-bold" style={{ color: 'var(--teal)' }}>{ticks.length}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

// ── SSE hook ──────────────────────────────────────────────────────────────────

interface SsePayload { type: 'competition' | 'feed' | 'chat' | 'prices' | 'error'; data: unknown }

function useCompetitionStream(id: string) {
  const [comp, setComp] = useState<Competition | null>(null)
  const [feed, setFeed] = useState<TradeEvent[]>([])
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [restPrices, setRestPrices] = useState<Record<string, number>>({})
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loadError, setLoadError] = useState(false)
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

  // Seed prices IMMEDIATELY on mount so chart/UI doesn't wait for WS/SSE
  useEffect(() => {
    fetch('/api/prices').then(r => r.json()).then(p => {
      if (p && typeof p === 'object') setRestPrices(prev => ({ ...prev, ...p }))
    }).catch(() => {})
  }, [])

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
          if (msg.type === 'chat') setChat(msg.data as ChatMessage[])
          if (msg.type === 'error') pollRest() // competition not found on this instance
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

  // Show load error after 12 seconds with no competition data
  useEffect(() => {
    if (comp) return
    const t = setTimeout(() => setLoadError(true), 12000)
    return () => clearTimeout(t)
  }, [comp])

  return { comp, feed, chat, restPrices, leaderboard, sseConnected: connected, loadError }
}

// ── Elfa AI Trending hook ─────────────────────────────────────────────────────

function useElfaTrending() {
  const [tokens, setTokens] = useState<TrendingToken[]>([])
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function fetchTrending() {
      try {
        const res = await fetch('/api/elfa/trending?timeWindow=4h')
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setEnabled(data.enabled ?? false)
        setTokens(data.tokens ?? [])
      } catch { /* silent */ }
    }
    fetchTrending()
    const t = setInterval(fetchTrending, 5 * 60 * 1000) // refresh every 5 min
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  return { tokens, enabled }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ArenaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const { comp, feed, chat, restPrices, leaderboard, sseConnected, loadError } = useCompetitionStream(id)
  const { tickers, wsConnected } = usePacificaWs()
  const { tokens: elfaTokens, enabled: elfaEnabled } = useElfaTrending()

  const [settled, setSettled] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)

  const [symbol, setSymbol] = useState('BTC')
  const [side, setSide] = useState<'bid' | 'ask'>('bid')
  const [amount, setAmount] = useState('0.01')
  const [leverage, setLeverage] = useState(5)
  const [tradeLoading, setTradeLoading] = useState(false)
  const [tradeMsg, setTradeMsg] = useState('')
  const [lastPacificaId, setLastPacificaId] = useState<string | null>(null)
  const [rightTab, setRightTab] = useState<'feed' | 'chat'>('feed')
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const [tradeMode, setTradeMode] = useState<'virtual' | 'testnet'>('virtual')
  const [chartView, setChartView] = useState<'chart' | 'tide'>('chart')
  const [tradeFlash, setTradeFlash] = useState<'long' | 'short' | 'close' | null>(null)
  const [pendingSign, setPendingSign] = useState<{
    action: 'open' | 'close'
    clientOrderId: string
    symbol: string
    side: 'bid' | 'ask'
    amount: number
    leverage: number
    currentPrice: number
  } | null>(null)

  const SIGNER_PUBKEY = 'CChSvcry2rHLYquyC1WApGZ5HtsLRd3ZzV6Ji8rcARzj'
  const BUILDER_CODE = 'TIDALWARS'

  const [unlocked, setUnlocked] = useState<Set<string>>(new Set())
  const [achievementToast, setAchievementToast] = useState<Achievement | null>(null)
  const chatCountRef = useRef(0)

  useEffect(() => { setUnlocked(loadUnlocked(id)) }, [id])

  const unlock = useCallback((achId: string) => {
    setUnlocked(prev => {
      if (prev.has(achId)) return prev
      const next = new Set(prev).add(achId)
      saveUnlocked(id, next)
      const ach = ACHIEVEMENTS[achId]
      if (ach) setAchievementToast(ach)
      return next
    })
  }, [id])

  useEffect(() => {
    if (!achievementToast) return
    const t = setTimeout(() => setAchievementToast(null), 3500)
    return () => clearTimeout(t)
  }, [achievementToast])

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
  const priceHistory = usePriceHistory(prices, symbol)

  const [pointsAwarded, setPointsAwarded] = useState<{ earned: number; totalPoints: number } | null>(null)

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
      const mine = (data.pointsAwards as { userId: string; earned: number; totalPoints: number }[] | undefined)
        ?.find(p => p.userId === userId)
      if (mine) setPointsAwarded({ earned: mine.earned, totalPoints: mine.totalPoints })
    } catch { /* ignore */ }
  }, [id, settled, userId])

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

  async function handleTrade(action: 'open' | 'close', clientOrderId?: string, closePos?: Position) {
    const currentPrice = prices[closePos?.symbol ?? symbol] ?? 0
    const tradeSymbol = closePos?.symbol ?? symbol
    const tradeSide = closePos?.side ?? side
    const tradeAmount = closePos?.amount ?? parseFloat(amount)
    const tradeLeverage = closePos?.leverage ?? leverage

    // TESTNET mode with open/close — show signing modal first
    if (tradeMode === 'testnet') {
      setPendingSign({
        action,
        clientOrderId: clientOrderId ?? crypto.randomUUID(),
        symbol: tradeSymbol,
        side: tradeSide,
        amount: tradeAmount,
        leverage: tradeLeverage,
        currentPrice,
      })
      return
    }
    await submitTrade(action, clientOrderId, tradeSymbol, tradeSide, tradeAmount, tradeLeverage, currentPrice)
  }

  async function submitTrade(
    action: 'open' | 'close',
    clientOrderId: string | undefined,
    tSymbol: string, tSide: 'bid' | 'ask',
    tAmount: number, tLeverage: number,
    currentPrice: number,
  ) {
    setTradeLoading(true)
    setTradeMsg('')
    try {
      const res = await fetch(`/api/competitions/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action, userId, displayName, symbol: tSymbol, side: tSide,
          amount: tAmount, leverage: tLeverage, clientOrderId, currentPrice,
          mode: tradeMode,
        }),
      })
      const data = await res.json()
      if (data.success) {
        if (action === 'open') {
          const onChain = data.pacifica?.success
          setLastPacificaId(data.pacifica?.orderId ?? null)
          setTradeFlash(tSide === 'bid' ? 'long' : 'short')

          // Achievements on open
          unlock('first_blood')
          const notional = currentPrice * tAmount * tLeverage
          if (notional >= 10000) unlock('whale_size')
          if (tLeverage === comp?.maxLeverage) unlock('max_leverage')
          if (elfaTokens.some(t => t.symbol === tSymbol && t.rank <= 10)) unlock('trending_trade')

          setTradeMsg(onChain
            ? `⬡ ORDER ON PACIFICA · ${data.pacifica.orderId?.slice(0, 10)}...`
            : tradeMode === 'testnet'
              ? `⚡ Signed order submitted · Competition P&L tracking live`
              : `🌊 POSITION OPENED · ${tSide === 'bid' ? 'LONG' : 'SHORT'} ${tAmount} ${tSymbol} @ ${tLeverage}x`)
        } else {
          const pnl = data.pnl ?? 0
          setTradeFlash('close')
          setTradeMsg(`${pnl >= 0 ? '🏆 WINNING CLOSE' : '📉 CLOSED AT LOSS'} · PnL ${pnlPrefix(pnl)}$${Math.abs(pnl).toFixed(2)}`)

          // Achievements on close
          if (pnl > 0) unlock('winning_close')
          if (pnl >= 100) unlock('big_win')
          const margin = (currentPrice * tAmount) / tLeverage
          if (margin > 0 && (pnl / margin) * 100 >= 5) unlock('whale_hunt')
          // If total ROI now > 10%, unlock kraken
          const totalRealized = (comp?.participants?.[userId]?.realizedPnl ?? 0) + pnl
          if ((totalRealized / 10000) * 100 >= 10) unlock('kraken_tier')
        }
      } else {
        setTradeMsg(`⚠ ${data.error}`)
      }
    } finally {
      setTradeLoading(false)
      setPendingSign(null)
      setTimeout(() => setTradeMsg(''), 5000)
      setTimeout(() => setTradeFlash(null), 900)
    }
  }

  async function handleSendChat() {
    const text = chatInput.trim()
    if (!text || chatSending || !userId) return
    setChatSending(true)
    try {
      await fetch(`/api/competitions/${id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, displayName, text }),
      })
      setChatInput('')
      chatCountRef.current += 1
      if (chatCountRef.current >= 5) unlock('chatter')
    } finally {
      setChatSending(false)
    }
  }

  // Copy trade from opponent's feed event — replicate exact symbol/side/leverage/amount
  function copyTrade(ev: TradeEvent) {
    if (!userId || ev.action !== 'open') return
    setSymbol(ev.symbol)
    setSide(ev.side)
    setAmount(String(ev.amount))
    setLeverage(ev.leverage)
    // Flash a quick toast
    setTradeMsg(`📋 Copied ${ev.displayName}'s ${ev.side === 'bid' ? 'LONG' : 'SHORT'} ${ev.amount} ${ev.symbol} · review & execute`)
    setTimeout(() => setTradeMsg(''), 4000)
    // Scroll to trade form
    const form = document.getElementById('trade-form')
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function sendQuickReaction(emoji: string) {
    if (chatSending || !userId) return
    setChatSending(true)
    try {
      await fetch(`/api/competitions/${id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, displayName, text: emoji }),
      })
      chatCountRef.current += 1
      if (chatCountRef.current >= 5) unlock('chatter')
    } finally {
      setChatSending(false)
    }
  }

  // Auto-scroll chat to bottom on new message
  useEffect(() => {
    if (rightTab === 'chat' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chat.length, rightTab])

  // Live leaderboard computed from comp state + merged prices (WS + REST)
  const liveLeaderboard = useMemo<LeaderboardEntry[]>(() => {
    const participants = comp?.participants ? Object.values(comp.participants) : []
    if (participants.length === 0) return leaderboard
    const computed: LeaderboardEntry[] = participants.map((p, i) => {
      const unrealized = p.positions.reduce((s, pos) => {
        const cur = prices[pos.symbol] ?? pos.entryPrice
        const diff = pos.side === 'bid' ? cur - pos.entryPrice : pos.entryPrice - cur
        return s + diff * pos.amount * pos.leverage
      }, 0)
      const total = unrealized + p.realizedPnl
      return {
        userId: p.userId,
        displayName: p.displayName,
        walletAddress: p.walletAddress,
        unrealizedPnl: unrealized,
        realizedPnl: p.realizedPnl,
        totalPnl: total,
        roi: (total / 10000) * 100,
        positionCount: p.positions.length,
        rank: i + 1,
      }
    })
    computed.sort((a, b) => b.totalPnl - a.totalPnl)
    computed.forEach((e, i) => { e.rank = i + 1 })
    return computed
  }, [comp, prices, leaderboard])

  const myEntry = liveLeaderboard.find(e => e.userId === userId)
  const myPositions: Position[] = comp?.participants?.[userId]?.positions ?? []
  const isEnded = comp?.status === 'ended'
  const minutes = Math.floor(timeLeft / 60000)
  const seconds = Math.floor((timeLeft % 60000) / 1000)

  if (!comp) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="nb-card px-8 py-6 text-center" style={{ maxWidth: 360 }}>
        {loadError ? (
          <>
            <div className="text-2xl mb-3">⚠️</div>
            <div className="font-black text-sm tracking-widest mb-2" style={{ color: 'var(--loss)' }}>ARENA NOT FOUND</div>
            <div className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              The competition may have expired or is on a different server instance.
            </div>
            <button onClick={() => router.push('/')} className="nb-btn nb-btn-ghost w-full py-2">
              ← Back to Home
            </button>
          </>
        ) : (
          <>
            <Waves className="w-8 h-8 mx-auto mb-3 animate-pulse" style={{ color: 'var(--teal)' }} />
            <div className="font-black text-sm tracking-widest" style={{ color: 'var(--teal)' }}>LOADING ARENA...</div>
            <div className="text-xs mt-2" style={{ color: 'var(--text-dim)' }}>Connecting to competition...</div>
          </>
        )}
      </div>
    </div>
  )

  // ── Winner screen — shown as soon as leaderboard is available after end ──
  const displayWinner = leaderboard[0] ?? null
  if (isEnded && leaderboard.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="nb-card px-8 py-6 text-center" style={{ borderColor: 'var(--gold)' }}>
          <Trophy className="w-8 h-8 mx-auto mb-3 animate-pulse" style={{ color: 'var(--gold)' }} />
          <div className="font-black text-sm tracking-widest" style={{ color: 'var(--gold)' }}>CALCULATING RESULTS...</div>
        </div>
      </div>
    )
  }

  if (isEnded && displayWinner) {
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
              <div className="text-4xl mb-1" title={oceanRank(displayWinner.roi).title}>{oceanRank(displayWinner.roi).emoji}</div>
              <div className="text-2xl font-black mb-1" style={{ color: 'var(--text)' }}>{displayWinner.displayName}</div>
              <div className="text-xs font-black tracking-[0.2em] mb-2" style={{ color: 'var(--gold)' }}>
                {oceanRank(displayWinner.roi).title}
              </div>
              <div className="text-3xl font-black" style={{ color: displayWinner.totalPnl >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                {pnlPrefix(displayWinner.totalPnl)}{displayWinner.totalPnl.toFixed(2)} USDC
              </div>
              <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{displayWinner.roi.toFixed(2)}% ROI</div>
            </div>

            {/* YOUR REWARDS card */}
            {pointsAwarded && (
              <div className="p-4 mb-4" style={{
                background: 'linear-gradient(135deg, var(--surface-2) 0%, var(--surface-3) 100%)',
                border: '2px solid var(--teal)', boxShadow: '4px 4px 0px #000',
              }}>
                <div className="text-xs font-black tracking-widest mb-2" style={{ color: 'var(--teal)' }}>🏅 YOUR REWARDS</div>
                <div className="grid grid-cols-2 gap-3 text-left">
                  <div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Earned this arena</div>
                    <div className="text-2xl font-black" style={{ color: 'var(--teal)' }}>
                      +{pointsAwarded.earned.toLocaleString()}
                    </div>
                    <div className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Tidal Points</div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Captain Tier</div>
                    {(() => {
                      const cap = captainFor(pointsAwarded.totalPoints)
                      return (
                        <>
                          <div className="text-2xl">{cap.emoji}</div>
                          <div className="text-sm font-black tracking-wider" style={{ color: 'var(--gold)' }}>{cap.title}</div>
                          <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                            {pointsAwarded.totalPoints.toLocaleString()} total pts
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>
                <div className="text-xs mt-2 pt-2" style={{ borderTop: '1px solid var(--border-soft)', color: 'var(--text-dim)', fontSize: '10px' }}>
                  Points persist across arenas. Climb the Hall of Fame to become a Kraken 🐙
                </div>
              </div>
            )}

            <div className="nb-card overflow-hidden mb-4">
              {leaderboard.map((e, i) => {
                const rank = oceanRank(e.roi)
                return (
                  <div key={e.userId} className="flex items-center gap-3 px-4 py-3"
                    style={{
                      borderBottom: i < leaderboard.length - 1 ? '2px solid #000' : undefined,
                      background: e.userId === userId ? 'rgba(0,200,224,0.08)' : undefined,
                    }}>
                    <span className="font-black w-6 text-center" style={{
                      color: i === 0 ? 'var(--gold)' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : 'var(--text-muted)',
                    }}>#{e.rank}</span>
                    <span className="text-lg" title={rank.title}>{rank.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{e.displayName}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{rank.title}</div>
                    </div>
                    <span className="font-black text-sm" style={{ color: e.totalPnl >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                      {pnlPrefix(e.totalPnl)}{e.totalPnl.toFixed(2)}
                    </span>
                    <span className="text-xs w-14 text-right" style={{ color: 'var(--text-muted)' }}>{e.roi.toFixed(1)}%</span>
                  </div>
                )
              })}
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
                  body: JSON.stringify({ name: `${comp.name} II`, creatorId: userId, durationMinutes: comp.durationMinutes }),
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
  const flashColor = tradeFlash === 'long' ? 'rgba(0,232,122,0.18)'
                   : tradeFlash === 'short' ? 'rgba(255,68,102,0.18)'
                   : tradeFlash === 'close' ? 'rgba(255,215,0,0.18)' : null
  const flashText = tradeFlash === 'long' ? '🌊 LONG OPENED'
                  : tradeFlash === 'short' ? '🔻 SHORT OPENED'
                  : tradeFlash === 'close' ? '⚓ POSITION CLOSED' : ''

  return (
    <div className="min-h-screen flex flex-col ocean-depth relative">

      {/* Full-screen trade flash overlay */}
      {flashColor && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          style={{ background: flashColor, animation: 'fadeOut 0.9s ease-out forwards' }}
        >
          <div className="nb-card px-8 py-6 text-center"
            style={{
              background: 'var(--surface)',
              borderColor: tradeFlash === 'long' ? 'var(--profit)'
                         : tradeFlash === 'short' ? 'var(--loss)' : 'var(--gold)',
              borderWidth: 3,
              boxShadow: '8px 8px 0px #000',
              animation: 'scaleIn 0.4s ease-out',
            }}>
            <div className="text-4xl font-black tracking-widest" style={{
              color: tradeFlash === 'long' ? 'var(--profit)'
                   : tradeFlash === 'short' ? 'var(--loss)' : 'var(--gold)',
            }}>
              {flashText}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes scaleIn { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>

      {/* Achievement unlock toast */}
      {achievementToast && (
        <div className="fixed top-16 right-4 z-[150] nb-card px-4 py-3 flex items-center gap-3 toast-slide-in"
          style={{
            borderColor: 'var(--gold)', borderWidth: 3, boxShadow: '6px 6px 0px #000',
            background: 'var(--surface)',
            maxWidth: 320,
          }}>
          <div className="text-3xl">{achievementToast.emoji}</div>
          <div>
            <div className="text-xs font-black tracking-widest mb-0.5" style={{ color: 'var(--gold)' }}>
              🏅 ACHIEVEMENT UNLOCKED
            </div>
            <div className="font-black text-sm" style={{ color: 'var(--text)' }}>{achievementToast.title}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{achievementToast.description}</div>
          </div>
        </div>
      )}

      {/* TESTNET signing modal — Privy wallet if connected, else server demo keypair */}
      <SigningModal
        isOpen={pendingSign !== null}
        onClose={() => setPendingSign(null)}
        onConfirmServerSign={() => {
          if (!pendingSign) return
          submitTrade(
            pendingSign.action,
            pendingSign.clientOrderId,
            pendingSign.symbol,
            pendingSign.side,
            pendingSign.amount,
            pendingSign.leverage,
            pendingSign.currentPrice,
          )
        }}
        onPrivySubmitted={(response) => {
          // Privy already signed + relayed; also record in our competition state for PnL
          if (!pendingSign) return
          setTradeFlash(pendingSign.side === 'bid' ? 'long' : 'short')
          const pacificaOk = (response as { ok?: boolean })?.ok
          setTradeMsg(pacificaOk
            ? `⬡ SIGNED VIA PRIVY · Order landed on Pacifica`
            : `⬡ SIGNED VIA PRIVY · Pacifica returned error (see console)`)
          // Still record virtually so UI reflects position
          submitTrade(
            pendingSign.action,
            pendingSign.clientOrderId,
            pendingSign.symbol,
            pendingSign.side,
            pendingSign.amount,
            pendingSign.leverage,
            pendingSign.currentPrice,
          )
        }}
        trade={pendingSign}
        demoPubkey={SIGNER_PUBKEY}
        builderCode={BUILDER_CODE}
        loading={tradeLoading}
      />


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
          <h1 className="font-black text-sm truncate" style={{ color: "var(--text)" }}>{comp.name}</h1>
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
            <span className="text-xs hidden lg:flex items-center gap-1" style={{ color: 'var(--teal)' }} title={`Pacifica order: ${lastPacificaId}`}>
              <Zap className="w-3 h-3" /> on-chain
            </span>
          )}
          <span className="text-xs hidden lg:flex items-center gap-1 px-1.5 py-0.5 font-black"
            style={{ border: '1px solid #000', background: 'var(--teal)', color: '#000', fontSize: '10px' }}
            title="Orders routed with builder_code=tidalwars — earns builder rewards on Pacifica">
            ⬡ BUILDER
          </span>
          <span className="text-xs hidden lg:flex items-center gap-1 px-1.5 py-0.5 font-black"
            style={{ border: '1px solid #000', background: 'var(--border-soft)', color: 'var(--text-muted)', fontSize: '10px' }}
            title="Trade events tracked via Fuul Events API">
            FUUL
          </span>
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
            {liveLeaderboard.length === 0 ? (
              <div className="text-center text-xs py-8" style={{ color: 'var(--text-dim)' }}>No traders yet</div>
            ) : (
              liveLeaderboard.map((entry, i) => {
                const rank = oceanRank(entry.roi)
                return (
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
                      <span className="text-base" title={rank.title}>{rank.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{entry.displayName}</div>
                        <div className="text-xs font-black tracking-wider" style={{ color: 'var(--text-dim)', fontSize: '9px' }}>
                          {rank.title} · {entry.positionCount} open
                        </div>
                      </div>
                    </div>
                    <div className="text-xs font-black mt-0.5" style={{ color: entry.totalPnl >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                      {pnlPrefix(entry.totalPnl)}{entry.totalPnl.toFixed(2)}
                      <span className="font-normal ml-1" style={{ color: 'var(--text-muted)' }}>({entry.roi.toFixed(1)}%)</span>
                    </div>
                  </div>
                )
              })
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
              // Elfa-driven signal: is this symbol trending on social?
              const elfaSignal = elfaTokens.find(t => t.symbol === sym)
              const isTrending = Boolean(elfaSignal && elfaSignal.rank <= 10)

              return (
                <button key={sym} onClick={() => setSymbol(sym)}
                  className="flex flex-col items-start px-3 py-2 text-left min-w-[80px] flex-shrink-0 transition-all relative"
                  style={{
                    background: isSelected ? 'var(--teal)' : 'var(--surface)',
                    color: isSelected ? '#000' : 'white',
                    borderRight: '2px solid #000',
                    borderBottom: isSelected ? '2px solid var(--teal)' : undefined,
                  }}>
                  {isTrending && (
                    <span className="absolute top-0.5 right-1 text-[9px] font-black"
                      title={`Trending on Elfa AI — #${elfaSignal?.rank}${elfaSignal?.changePercent != null ? ` · ${elfaSignal.changePercent >= 0 ? '+' : ''}${elfaSignal.changePercent.toFixed(0)}% mentions` : ''}`}
                      style={{ color: isSelected ? '#000' : 'var(--gold)' }}>
                      🔥
                    </span>
                  )}
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

          {/* Chart view toggle (Candles from Pacifica /kline vs Tide Gauge ocean vibe) */}
          <div className="flex" style={{ borderBottom: '2px solid #000', background: 'var(--surface)' }}>
            <button onClick={() => setChartView('chart')}
              className="flex-1 py-1.5 text-xs font-black tracking-widest transition-colors flex items-center justify-center gap-1.5"
              style={{
                background: chartView === 'chart' ? 'var(--surface-2)' : 'var(--surface)',
                color: chartView === 'chart' ? 'var(--teal)' : 'var(--text-muted)',
                borderRight: '2px solid #000',
                borderBottom: chartView === 'chart' ? '2px solid var(--teal)' : '2px solid transparent',
              }}>
              📊 CANDLES
              <span style={{ fontSize: '9px', opacity: 0.6 }}>/kline</span>
            </button>
            <button onClick={() => setChartView('tide')}
              className="flex-1 py-1.5 text-xs font-black tracking-widest transition-colors flex items-center justify-center gap-1.5"
              style={{
                background: chartView === 'tide' ? 'var(--surface-2)' : 'var(--surface)',
                color: chartView === 'tide' ? 'var(--gold)' : 'var(--text-muted)',
                borderBottom: chartView === 'tide' ? '2px solid var(--gold)' : '2px solid transparent',
              }}>
              🌊 TIDE GAUGE
            </button>
          </div>

          {chartView === 'chart' ? (
            <CandleChart
              symbol={symbol}
              currentPrice={prices[symbol] ?? 0}
              entryPrices={myPositions
                .filter(p => p.symbol === symbol)
                .map(p => ({ price: p.entryPrice, side: p.side }))}
            />
          ) : (
            <TideGauge
              ticks={priceHistory}
              symbol={symbol}
              currentPrice={prices[symbol] ?? 0}
              entryPrices={myPositions
                .filter(p => p.symbol === symbol)
                .map(p => ({ price: p.entryPrice, side: p.side }))}
            />
          )}

          {/* Market stats row */}
          {currentTicker && (currentTicker.openInterest > 0 || currentTicker.volume24h > 0) && (
            <div className="flex gap-4 px-4 py-1.5 text-xs overflow-x-auto"
              style={{ borderBottom: '2px solid #000', background: 'var(--surface-2)' }}>
              {currentTicker.markPrice > 0 && (
                <span style={{ color: 'var(--text-muted)' }}>Mark <span className="font-bold" style={{ color: "var(--text)" }}>${fmtPrice(currentTicker.markPrice, symbol)}</span></span>
              )}
              {currentTicker.indexPrice > 0 && (
                <span style={{ color: 'var(--text-muted)' }}>Index <span className="font-bold" style={{ color: "var(--text)" }}>${fmtPrice(currentTicker.indexPrice, symbol)}</span></span>
              )}
              {currentTicker.openInterest > 0 && (
                <span style={{ color: 'var(--text-muted)' }}>OI <span className="font-bold" style={{ color: "var(--text)" }}>${fmtBig(currentTicker.openInterest)}</span></span>
              )}
              {currentTicker.volume24h > 0 && (
                <span style={{ color: 'var(--text-muted)' }}>24h Vol <span className="font-bold" style={{ color: "var(--text)" }}>${fmtBig(currentTicker.volume24h)}</span></span>
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

          {/* LIVE wallet card — client-side computed from WS prices */}
          {!isEnded && (() => {
            const STARTING = 10000
            const realized = comp.participants?.[userId]?.realizedPnl ?? 0
            const marginLocked = myPositions.reduce((s, p) => s + (p.entryPrice * p.amount) / p.leverage, 0)
            const unrealized = myPositions.reduce((s, p) => {
              const cur = prices[p.symbol] ?? p.entryPrice
              const diff = p.side === 'bid' ? cur - p.entryPrice : p.entryPrice - cur
              return s + diff * p.amount * p.leverage
            }, 0)
            const equity = STARTING + realized + unrealized
            const available = STARTING + realized - marginLocked
            const pct = ((equity - STARTING) / STARTING) * 100
            const pnlColor = (equity - STARTING) >= 0 ? 'var(--profit)' : 'var(--loss)'

            return (
              <div style={{ borderBottom: '2px solid #000', background: 'var(--surface-2)' }}>
                <div className="grid grid-cols-4 text-xs">
                  <div className="px-3 py-2" style={{ borderRight: '1px solid var(--border-soft)' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '9px', letterSpacing: '0.1em' }}>EQUITY</div>
                    <div className="font-black text-sm font-mono" style={{ color: pnlColor }}>
                      ${equity.toFixed(2)}
                    </div>
                    <div style={{ color: pnlColor, fontSize: '9px', fontWeight: 700 }}>
                      {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                    </div>
                  </div>
                  <div className="px-3 py-2" style={{ borderRight: '1px solid var(--border-soft)' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '9px', letterSpacing: '0.1em' }}>AVAILABLE</div>
                    <div className="font-black text-sm font-mono" style={{ color: 'var(--teal)' }}>
                      ${Math.max(0, available).toFixed(2)}
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '9px' }}>for new positions</div>
                  </div>
                  <div className="px-3 py-2" style={{ borderRight: '1px solid var(--border-soft)' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '9px', letterSpacing: '0.1em' }}>LOCKED</div>
                    <div className="font-black text-sm font-mono" style={{ color: marginLocked > 0 ? 'var(--gold)' : 'var(--text-dim)' }}>
                      ${marginLocked.toFixed(2)}
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '9px' }}>{myPositions.length} position{myPositions.length !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="px-3 py-2">
                    <div style={{ color: 'var(--text-muted)', fontSize: '9px', letterSpacing: '0.1em' }}>UNREALIZED P&L</div>
                    <div className="font-black text-sm font-mono" style={{ color: unrealized >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                      {unrealized >= 0 ? '+' : ''}${unrealized.toFixed(2)}
                    </div>
                    <div style={{ color: realized !== 0 ? (realized >= 0 ? 'var(--profit)' : 'var(--loss)') : 'var(--text-dim)', fontSize: '9px' }}>
                      realized: {realized >= 0 ? '+' : ''}${realized.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between px-3 py-1.5 text-xs"
                  style={{ borderTop: '1px solid var(--border-soft)' }}>
                  <span style={{ color: 'var(--text-dim)', fontSize: '10px' }}>
                    {tradeMode === 'virtual' ? '🌊 Virtual · updates live per WebSocket tick' : '⬡ Testnet mode · balance still virtual for competition PnL'}
                  </span>
                  <a href="https://test-app.pacifica.fi/" target="_blank" rel="noopener"
                    className="flex items-center gap-1 font-black"
                    style={{ color: 'var(--gold)', fontSize: '10px' }}
                    title="Deposit testnet USDC on Pacifica">
                    <ExternalLink className="w-3 h-3" /> FAUCET
                  </a>
                </div>
              </div>
            )
          })()}

          {/* Trade form */}
          {!isEnded ? (
            <div id="trade-form" className="p-4" style={{ borderBottom: '2px solid #000' }}>
              {/* Mode selector */}
              <div className="grid grid-cols-2 gap-0 mb-3 text-xs" style={{ border: '2px solid #000' }}>
                <button onClick={() => setTradeMode('virtual')}
                  className="py-2 font-black tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                  style={{
                    background: tradeMode === 'virtual' ? 'var(--teal)' : 'var(--surface)',
                    color: tradeMode === 'virtual' ? '#000' : 'var(--text-muted)',
                    borderRight: '2px solid #000',
                  }}>
                  🌊 VIRTUAL <span style={{ fontSize: '9px', opacity: 0.7 }}>$10K</span>
                </button>
                <button onClick={() => setTradeMode('testnet')}
                  className="py-2 font-black tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                  style={{
                    background: tradeMode === 'testnet' ? 'var(--gold)' : 'var(--surface)',
                    color: tradeMode === 'testnet' ? '#000' : 'var(--text-muted)',
                  }}>
                  ⬡ TESTNET <span style={{ fontSize: '9px', opacity: 0.7 }}>Real Orders</span>
                </button>
              </div>
              <div className="text-xs mb-3 px-2 py-1.5" style={{
                background: tradeMode === 'virtual' ? 'rgba(0,216,245,0.08)' : 'rgba(255,215,0,0.08)',
                border: `1px solid ${tradeMode === 'virtual' ? 'var(--teal)' : 'var(--gold)'}`,
                color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1.4,
              }}>
                {tradeMode === 'virtual'
                  ? 'Virtual $10k per arena. P&L tracks real Pacifica prices. No wallet or tokens needed.'
                  : 'Real Pacifica orders signed with Ed25519 + builder_code=TIDALWARS. Testnet orderbook may be shallow.'}
              </div>

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
                  {/* Size presets based on available balance */}
                  {(() => {
                    const realized = comp.participants?.[userId]?.realizedPnl ?? 0
                    const marginLocked = myPositions.reduce((s, p) => s + (p.entryPrice * p.amount) / p.leverage, 0)
                    const available = Math.max(0, 10000 + realized - marginLocked)
                    const price = prices[symbol] ?? 0
                    const maxAmount = price > 0 ? (available * leverage) / price : 0
                    const presets = [
                      { label: '25%', pct: 0.25 },
                      { label: '50%', pct: 0.5 },
                      { label: '75%', pct: 0.75 },
                      { label: 'MAX', pct: 0.99 },
                    ]
                    return (
                      <div className="flex gap-1 mt-1.5">
                        {presets.map(p => (
                          <button key={p.label} type="button"
                            onClick={() => setAmount((maxAmount * p.pct).toFixed(3))}
                            disabled={maxAmount === 0}
                            className="flex-1 py-1 text-xs font-black"
                            style={{
                              background: 'var(--surface)',
                              border: '1px solid var(--border-soft)',
                              color: 'var(--text-muted)',
                              cursor: maxAmount === 0 ? 'not-allowed' : 'pointer',
                              opacity: maxAmount === 0 ? 0.4 : 1,
                            }}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                    )
                  })()}
                </div>
                <div>
                  <label className="block text-xs font-black mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Leverage: <span style={{ color: 'var(--teal)' }}>{leverage}x</span>
                  </label>
                  <input type="range" min={1} max={comp.maxLeverage} step={1}
                    className="w-full mt-2" value={leverage} onChange={e => setLeverage(Number(e.target.value))} />
                  <div className="flex gap-1 mt-1.5">
                    {[2, 5, 10].filter(l => l <= comp.maxLeverage).map(l => (
                      <button key={l} type="button"
                        onClick={() => setLeverage(l)}
                        className="flex-1 py-1 text-xs font-black"
                        style={{
                          background: leverage === l ? 'var(--teal)' : 'var(--surface)',
                          border: '1px solid',
                          borderColor: leverage === l ? 'var(--teal)' : 'var(--border-soft)',
                          color: leverage === l ? '#000' : 'var(--text-muted)',
                        }}>
                        {l}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Order info */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                <span>Notional <span className="font-bold" style={{ color: "var(--text)" }}>
                  ${((prices[symbol] ?? 0) * parseFloat(amount || '0') * leverage).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span></span>
                <span>Margin <span className="font-bold" style={{ color: "var(--text)" }}>
                  ${((prices[symbol] ?? 0) * parseFloat(amount || '0') / leverage).toFixed(2)}
                </span></span>
                {currentTicker?.fundingRate !== undefined && currentTicker.fundingRate !== 0 && (
                  <span>Funding <span className="font-bold" style={{ color: currentTicker.fundingRate >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                    {currentTicker.fundingRate >= 0 ? '+' : ''}{(currentTicker.fundingRate * 100).toFixed(4)}%/8h
                  </span></span>
                )}
              </div>

              {(prices[symbol] ?? 0) === 0 && (
                <div className="mb-2 text-xs text-center py-1.5 px-3 font-bold"
                  style={{ background: 'rgba(255,68,102,0.1)', border: '1px solid var(--loss)', color: 'var(--loss)' }}>
                  ⚠ Waiting for price feed...
                </div>
              )}
              <button onClick={() => handleTrade('open')}
                disabled={tradeLoading || !userId || (prices[symbol] ?? 0) === 0}
                className="nb-btn w-full py-3 text-sm"
                style={{
                  background: side === 'bid' ? 'var(--profit)' : 'var(--loss)',
                  color: side === 'bid' ? '#000' : '#fff',
                  border: '2px solid #000',
                  boxShadow: 'var(--nb-shadow)',
                }}>
                {tradeLoading ? '...' : (prices[symbol] ?? 0) === 0 ? 'LOADING PRICE...' : `${side === 'bid' ? '▲ LONG' : '▼ SHORT'} ${symbol} ${leverage}x`}
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
                  const cur = (prices[pos.symbol] && prices[pos.symbol] > 0) ? prices[pos.symbol] : (pos.entryPrice || 0)
                  const ep = pos.entryPrice || 0
                  const priceDiff = pos.side === 'bid' ? cur - ep : ep - cur
                  const upnl = isFinite(priceDiff) && isFinite(pos.amount) && isFinite(pos.leverage)
                    ? priceDiff * pos.amount * pos.leverage : 0
                  const liq = ep > 0 ? liqPrice({ ...pos, entryPrice: ep }) : 0
                  const health = ep > 0 ? posHealth({ ...pos, entryPrice: ep }, cur) : 1
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
                            <button onClick={() => handleTrade('close', pos.clientOrderId, pos)}
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
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="text-3xl mb-2 opacity-50">🌊</div>
              <div className="text-xs font-black tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
                READY TO TRADE
              </div>
              <div className="text-xs" style={{ color: 'var(--text-dim)', maxWidth: 280 }}>
                Pick a symbol above, choose LONG or SHORT, and hit the trade button to open your first position.
              </div>
              {elfaTokens.length > 0 && (
                <div className="mt-3 text-xs font-bold flex items-center gap-1" style={{ color: 'var(--gold)' }}>
                  <Sparkles className="w-3 h-3" />
                  <span>🔥 {elfaTokens.slice(0,3).map(t => t.symbol).join(' · ')} trending now</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Feed/Chat tabs + Elfa Pulse ─────────────────────────── */}
        <div className="w-60 flex flex-col" style={{ borderLeft: '2px solid #000' }}>
          {/* Tab header */}
          <div className="grid grid-cols-2" style={{ borderBottom: '2px solid #000' }}>
            <button onClick={() => setRightTab('feed')}
              className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-black tracking-widest uppercase transition-colors"
              style={{
                background: rightTab === 'feed' ? 'var(--surface)' : 'var(--surface-2)',
                color: rightTab === 'feed' ? 'var(--teal)' : 'var(--text-muted)',
                borderRight: '2px solid #000',
                borderBottom: rightTab === 'feed' ? '2px solid var(--teal)' : undefined,
              }}>
              <span className="live-dot-teal" /> Feed
              <span style={{ fontSize: '10px', opacity: 0.7 }}>{feed.length}</span>
            </button>
            <button onClick={() => setRightTab('chat')}
              className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-black tracking-widest uppercase transition-colors relative"
              style={{
                background: rightTab === 'chat' ? 'var(--surface)' : 'var(--surface-2)',
                color: rightTab === 'chat' ? 'var(--gold)' : 'var(--text-muted)',
                borderBottom: rightTab === 'chat' ? '2px solid var(--gold)' : undefined,
              }}>
              <MessageCircle className="w-3 h-3" /> Chat
              <span style={{ fontSize: '10px', opacity: 0.7 }}>{chat.length}</span>
            </button>
          </div>

          {/* Feed content */}
          {rightTab === 'feed' && (
            <div className="overflow-y-auto" style={{ flex: '1 1 0', minHeight: 0 }}>
              {feed.length === 0 ? (
                <div className="text-center py-10">
                  <BarChart2 className="w-5 h-5 mx-auto mb-2 opacity-20" style={{ color: 'var(--teal)' }} />
                  <div className="text-xs font-black tracking-widest" style={{ color: 'var(--text-dim)' }}>WAITING...</div>
                </div>
              ) : (
                feed.map((event, i) => (
                  <div key={event.id} className={`px-3 py-2 ${i === 0 && Date.now() - event.timestamp < 4000 ? 'flash-new' : ''}`}
                    style={{ borderBottom: '2px solid #000' }}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-black truncate flex-1" style={{ color: 'var(--text)' }}>{event.displayName}</span>
                      <span className="text-xs px-1 py-0.5 font-black" style={{
                        background: event.action === 'open'
                          ? (event.side === 'bid' ? 'var(--profit)' : 'var(--loss)')
                          : 'var(--border-soft)',
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
                    {/* Copy trade — Social & Gamification track feature */}
                    {event.action === 'open' && event.userId !== userId && userId && !isEnded && (
                      <button onClick={() => copyTrade(event)}
                        className="mt-1.5 w-full flex items-center justify-center gap-1 py-1 text-xs font-black tracking-wider transition-colors"
                        style={{
                          background: 'var(--surface-3)',
                          color: 'var(--teal)',
                          border: '1px solid var(--teal)',
                          fontSize: '10px',
                        }}
                        title={`Copy ${event.displayName}'s ${event.side === 'bid' ? 'LONG' : 'SHORT'}`}>
                        <Copy className="w-2.5 h-2.5" /> COPY TRADE
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Chat content */}
          {rightTab === 'chat' && (
            <div className="flex flex-col" style={{ flex: '1 1 0', minHeight: 0 }}>
              <div ref={chatScrollRef} className="overflow-y-auto flex flex-col-reverse"
                style={{ flex: '1 1 0', minHeight: 0 }}>
                {chat.length === 0 ? (
                  <div className="text-center py-10">
                    <MessageCircle className="w-5 h-5 mx-auto mb-2 opacity-20" style={{ color: 'var(--gold)' }} />
                    <div className="text-xs font-black tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>NO MESSAGES</div>
                    <div className="text-xs" style={{ color: 'var(--text-dim)' }}>Talk smack to your opponents</div>
                  </div>
                ) : (
                  chat.map(m => (
                    <div key={m.id} className="px-3 py-1.5" style={{ borderBottom: '1px solid var(--border-soft)' }}>
                      <div className="flex items-baseline gap-1.5 mb-0.5">
                        <span className="text-xs font-black truncate" style={{
                          color: m.userId === userId ? 'var(--teal)' : 'var(--gold)',
                          maxWidth: 100,
                        }}>{m.displayName}</span>
                        <span className="text-xs" style={{ color: 'var(--text-dim)', fontSize: '10px' }}>
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-xs break-words" style={{ color: 'var(--text)', lineHeight: 1.35 }}>
                        {m.text}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Chat input */}
              <div style={{ borderTop: '2px solid #000', background: 'var(--surface-2)' }}>
                {userId ? (
                  <>
                    {/* Ocean quick-reactions */}
                    <div className="flex gap-1 px-2 pt-2 flex-wrap">
                      {['🌊','🦈','🐋','🔥','💀','🚀','🎣'].map(e => (
                        <button key={e} className="emoji-btn"
                          onClick={() => sendQuickReaction(e)}
                          disabled={chatSending}
                          title={`Send ${e}`}>
                          {e}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-1.5 p-2">
                      <input type="text" maxLength={200}
                        className="nb-input text-xs"
                        style={{ flex: 1 }}
                        placeholder="Say something..."
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                        disabled={chatSending}
                      />
                      <button onClick={handleSendChat}
                        disabled={chatSending || !chatInput.trim()}
                        className="nb-btn nb-btn-primary px-2.5 py-1.5">
                        <Send className="w-3 h-3" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-center py-3" style={{ color: 'var(--text-dim)' }}>
                    Join the arena to chat
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Elfa AI Social Pulse ─────────────────────────────────────── */}
          <div style={{ borderTop: '2px solid #000', flexShrink: 0 }}>
            <div className="flex items-center justify-between px-3 py-2"
              style={{ borderBottom: '2px solid #000', background: 'var(--surface)' }}>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" style={{ color: 'var(--gold)' }} />
                <span className="text-xs font-black tracking-widest uppercase" style={{ color: 'var(--gold)' }}>
                  Social Pulse
                </span>
              </div>
              <span className="text-xs font-black px-1" style={{
                background: elfaEnabled ? 'var(--gold)' : 'var(--border-soft)',
                color: elfaEnabled ? '#000' : 'var(--text-dim)',
                border: '1px solid #000',
                fontSize: '9px',
              }}>
                ELFA
              </span>
            </div>

            {elfaEnabled && elfaTokens.length > 0 ? (
              <div>
                {elfaTokens.slice(0, 5).map(tok => (
                  <div key={tok.symbol} className="flex items-center gap-2 px-3 py-1.5"
                    style={{ borderBottom: '1px solid #000' }}>
                    <span className="text-xs font-black w-4 text-center" style={{ color: 'var(--text-dim)' }}>
                      {tok.rank}
                    </span>
                    <span className="text-xs font-black flex-1" style={{ color: 'var(--teal)' }}>
                      {tok.symbol}
                    </span>
                    <div className="text-right">
                      <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                        {tok.mentionCount.toLocaleString()}
                      </div>
                      {tok.changePercent != null && (
                        <div className="text-xs font-black" style={{
                          color: tok.changePercent >= 0 ? 'var(--profit)' : 'var(--loss)',
                          fontSize: '10px',
                        }}>
                          {tok.changePercent >= 0 ? '+' : ''}{tok.changePercent.toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div className="px-3 py-1.5 text-center" style={{ fontSize: '9px', color: 'var(--text-dim)' }}>
                  powered by Elfa AI · 4h window
                </div>
              </div>
            ) : (
              <div className="px-3 py-4 text-center" style={{ color: 'var(--text-dim)', fontSize: '10px' }}>
                {elfaEnabled ? 'Loading...' : 'ELFA_API_KEY not set'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
