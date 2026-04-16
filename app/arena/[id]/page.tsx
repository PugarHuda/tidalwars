'use client'
import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { Trophy, TrendingUp, TrendingDown, Clock, ArrowLeft, Zap, Activity } from 'lucide-react'
import { Competition, LeaderboardEntry, TradeEvent } from '@/lib/types'

const SYMBOLS = ['BTC', 'ETH', 'SOL', 'WIF', 'BONK']

export default function ArenaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [comp, setComp] = useState<Competition | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [feed, setFeed] = useState<TradeEvent[]>([])
  const [settled, setSettled] = useState(false)
  const [winner, setWinner] = useState<LeaderboardEntry | null>(null)
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [timeLeft, setTimeLeft] = useState(0)

  // Trade panel state
  const [symbol, setSymbol] = useState('BTC')
  const [side, setSide] = useState<'bid' | 'ask'>('bid')
  const [amount, setAmount] = useState('0.01')
  const [leverage, setLeverage] = useState(5)
  const [tradeLoading, setTradeLoading] = useState(false)
  const [tradeMsg, setTradeMsg] = useState('')

  const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') ?? '' : ''
  const displayName = typeof window !== 'undefined' ? localStorage.getItem('displayName') ?? 'Anon' : 'Anon'

  const triggerSettle = useCallback(async (currentPrices: Record<string, number>) => {
    if (settled) return
    setSettled(true)
    try {
      const res = await fetch(`/api/competitions/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'settle', prices: currentPrices }),
      })
      const data = await res.json()
      if (data.final?.length > 0) setWinner(data.final[0])
    } catch { /* ignore */ }
  }, [id, settled])

  const fetchAll = useCallback(async () => {
    const [compRes, priceRes, feedRes] = await Promise.all([
      fetch(`/api/competitions/${id}`).then(r => r.json()),
      fetch('/api/prices').then(r => r.json()),
      fetch(`/api/feed/${id}`).then(r => r.json()),
    ])
    setComp(compRes)
    setPrices(priceRes)
    setFeed(feedRes)

    const lbRes = await fetch(`/api/leaderboard/${id}?prices=${encodeURIComponent(JSON.stringify(priceRes))}`)
    const lb = await lbRes.json()
    setLeaderboard(lb.entries ?? [])

    // Trigger auto-settle if time is up and not yet settled
    if (compRes.status === 'ended' && !settled) {
      await triggerSettle(priceRes)
    }
  }, [id, settled, triggerSettle])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 3000)
    return () => clearInterval(interval)
  }, [fetchAll])

  // Timer
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
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitionId: id,
          userId,
          displayName,
          symbol,
          side,
          amount: parseFloat(amount),
          leverage,
          action,
          clientOrderId,
          currentPrice,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setTradeMsg(action === 'open' ? '✅ Position opened!' : `✅ Closed! PnL: $${data.pnl?.toFixed(2)}`)
        fetchAll()
      } else {
        setTradeMsg(`❌ ${data.error}`)
      }
    } finally {
      setTradeLoading(false)
      setTimeout(() => setTradeMsg(''), 3000)
    }
  }

  const myEntry = leaderboard.find(e => e.userId === userId)
  const myPositions = comp?.participants?.[userId]?.positions ?? []

  const minutes = Math.floor(timeLeft / 60000)
  const seconds = Math.floor((timeLeft % 60000) / 1000)
  const isEnded = comp?.status === 'ended'

  if (!comp) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-gray-400">Loading arena...</div>
    </div>
  )

  // Winner overlay — shown after settlement
  if (isEnded && winner && leaderboard.length > 0) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-lg w-full">
          {/* Confetti-like header */}
          <div className="text-6xl mb-4">🏆</div>
          <h1 className="text-4xl font-extrabold mb-2 text-yellow-400">Competition Over!</h1>
          <p className="text-gray-400 mb-8">{comp.name} · Final Results</p>

          {/* Winner card */}
          <div className="bg-gradient-to-br from-yellow-900/40 to-amber-900/20 border border-yellow-600/50 rounded-2xl p-6 mb-6">
            <div className="text-xs text-yellow-400 font-semibold mb-1 uppercase tracking-wider">Winner</div>
            <div className="text-2xl font-bold text-white mb-1">{winner.displayName}</div>
            <div className={`text-3xl font-extrabold ${winner.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {winner.totalPnl >= 0 ? '+' : ''}{winner.totalPnl.toFixed(2)} USDC
            </div>
            <div className="text-sm text-gray-400 mt-1">{winner.roi.toFixed(2)}% ROI</div>
          </div>

          {/* Full leaderboard */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">
            {leaderboard.map((e, i) => (
              <div key={e.userId} className={`flex items-center gap-3 px-4 py-3 border-b border-gray-800 last:border-0 ${e.userId === userId ? 'bg-blue-900/20' : ''}`}>
                <span className={`text-sm font-bold w-6 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-600'}`}>
                  #{e.rank}
                </span>
                <span className="flex-1 text-sm font-medium">{e.displayName}</span>
                <span className={`text-sm font-bold ${e.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {e.totalPnl >= 0 ? '+' : ''}{e.totalPnl.toFixed(2)}
                </span>
                <span className="text-xs text-gray-500 w-16 text-right">{e.roi.toFixed(1)}%</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={() => router.push('/')} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-semibold transition-colors">
              Back to Home
            </button>
            <button
              onClick={async () => {
                const res = await fetch('/api/competitions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: `${comp.name} Rematch`,
                    creatorId: userId,
                    durationMinutes: comp.durationMinutes,
                  }),
                })
                const newComp = await res.json()
                await fetch(`/api/competitions/${newComp.id}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId, displayName }),
                })
                router.push(`/arena/${newComp.id}`)
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-semibold transition-colors"
            >
              🔄 Rematch
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top bar */}
      <header className="border-b border-gray-800 px-4 py-3 flex items-center gap-4">
        <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-white">{comp.name}</h1>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>{Object.keys(comp.participants ?? {}).length} traders</span>
            <span>·</span>
            <span className={isEnded ? 'text-red-400' : 'text-green-400'}>
              {isEnded ? 'Competition Ended' : `${minutes}m ${seconds}s remaining`}
            </span>
          </div>
        </div>
        {myEntry && (
          <div className="text-right text-sm">
            <div className={`font-bold ${myEntry.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {myEntry.totalPnl >= 0 ? '+' : ''}{myEntry.totalPnl.toFixed(2)} USDC
            </div>
            <div className="text-xs text-gray-500">Rank #{myEntry.rank}</div>
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Leaderboard */}
        <div className="w-64 border-r border-gray-800 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold">Leaderboard</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {leaderboard.map((entry, i) => (
              <div
                key={entry.userId}
                className={`px-4 py-3 border-b border-gray-800/50 ${entry.userId === userId ? 'bg-blue-900/20' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold w-5 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-600'}`}>
                    #{entry.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{entry.displayName}</div>
                    <div className="text-xs text-gray-500">{entry.positionCount} pos open</div>
                  </div>
                </div>
                <div className={`text-sm font-bold mt-1 ${entry.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {entry.totalPnl >= 0 ? '+' : ''}{entry.totalPnl.toFixed(2)}
                  <span className="text-xs ml-1 opacity-70">({entry.roi.toFixed(1)}%)</span>
                </div>
              </div>
            ))}
            {leaderboard.length === 0 && (
              <div className="text-center text-gray-600 text-sm py-8">No traders yet</div>
            )}
          </div>
        </div>

        {/* Center: Trade Panel + Prices */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Price bar */}
          <div className="flex gap-4 px-4 py-2 border-b border-gray-800 overflow-x-auto">
            {SYMBOLS.map(sym => (
              <button
                key={sym}
                onClick={() => setSymbol(sym)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${symbol === sym ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                <span className="font-semibold">{sym}</span>
                <span className="text-xs opacity-80">
                  ${prices[sym]?.toLocaleString(undefined, { maximumFractionDigits: sym === 'BONK' ? 8 : 2 }) ?? '—'}
                </span>
              </button>
            ))}
          </div>

          {/* Trade panel */}
          {!isEnded ? (
            <div className="p-4 border-b border-gray-800">
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  onClick={() => setSide('bid')}
                  className={`py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${side === 'bid' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  <TrendingUp className="w-4 h-4" /> Long
                </button>
                <button
                  onClick={() => setSide('ask')}
                  className={`py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${side === 'ask' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  <TrendingDown className="w-4 h-4" /> Short
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Amount ({symbol})</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Leverage: {leverage}x</label>
                  <input
                    type="range" min={1} max={comp.maxLeverage} step={1}
                    className="w-full mt-2"
                    value={leverage}
                    onChange={e => setLeverage(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="text-xs text-gray-500 mb-3">
                Notional: ${((prices[symbol] ?? 0) * parseFloat(amount || '0') * leverage).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>

              <button
                onClick={() => handleTrade('open')}
                disabled={tradeLoading || !userId}
                className={`w-full py-3 rounded-lg font-semibold text-sm transition-colors ${side === 'bid' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {tradeLoading ? 'Placing...' : `${side === 'bid' ? 'Long' : 'Short'} ${symbol} ${leverage}x`}
              </button>

              {tradeMsg && (
                <div className="mt-2 text-xs text-center text-gray-300">{tradeMsg}</div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500 border-b border-gray-800">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Competition ended</p>
            </div>
          )}

          {/* Open Positions */}
          {myPositions.length > 0 && (
            <div className="p-4 border-b border-gray-800">
              <h3 className="text-xs font-semibold text-gray-400 mb-2">MY OPEN POSITIONS</h3>
              <div className="space-y-2">
                {myPositions.map(pos => {
                  const currentPrice = prices[pos.symbol] ?? pos.entryPrice
                  const priceDiff = pos.side === 'bid' ? currentPrice - pos.entryPrice : pos.entryPrice - currentPrice
                  const unrealizedPnl = priceDiff * pos.amount * pos.leverage
                  return (
                    <div key={pos.clientOrderId} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{pos.symbol}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${pos.side === 'bid' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                            {pos.side === 'bid' ? 'LONG' : 'SHORT'} {pos.leverage}x
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          Entry: ${pos.entryPrice.toFixed(2)} · {pos.amount} {pos.symbol}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`text-sm font-bold ${unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toFixed(2)}
                        </div>
                        {!isEnded && (
                          <button
                            onClick={() => {
                              setSymbol(pos.symbol)
                              handleTrade('close', pos.clientOrderId)
                            }}
                            className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-colors"
                          >
                            Close
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Live Feed */}
        <div className="w-64 border-l border-gray-800 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
            <span className="text-sm font-semibold">Live Feed</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {feed.map(event => (
              <div key={event.id} className="px-4 py-3 border-b border-gray-800/50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-white truncate">{event.displayName}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ml-auto ${event.action === 'open' ? (event.side === 'bid' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400') : 'bg-gray-700 text-gray-300'}`}>
                    {event.action === 'open' ? (event.side === 'bid' ? 'LONG' : 'SHORT') : 'CLOSED'}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  {event.amount} {event.symbol} @ ${event.price.toFixed(2)}
                  {event.leverage && ` · ${event.leverage}x`}
                </div>
                {event.pnl !== undefined && (
                  <div className={`text-xs font-semibold mt-1 ${event.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {event.pnl >= 0 ? '+' : ''}{event.pnl.toFixed(2)} USDC
                  </div>
                )}
                <div className="text-xs text-gray-600 mt-1">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
            {feed.length === 0 && (
              <div className="text-center text-gray-600 text-sm py-8">
                <Zap className="w-6 h-6 mx-auto mb-2 opacity-30" />
                Waiting for trades...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
