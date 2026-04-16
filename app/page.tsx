'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Trophy, Clock, Users, Zap, Globe, Wifi, WifiOff, Waves } from 'lucide-react'
import { Competition } from '@/lib/types'
import WalletButton from '@/components/WalletButton'
import { usePacificaWs } from '@/lib/pacificaWs'

const DURATIONS = [
  { label: '1 min (test)', value: 1 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '4 hours', value: 240 },
]

const TICKER_SYMBOLS = ['BTC', 'ETH', 'SOL', 'WIF', 'BONK']

export default function Home() {
  const router = useRouter()
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [name, setName] = useState('')
  const [duration, setDuration] = useState(30)
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [globalStats, setGlobalStats] = useState<{ totalTraders: number; globalTrades: number; totalCompetitions: number } | null>(null)

  const { tickers, wsConnected } = usePacificaWs()

  useEffect(() => {
    fetch('/api/competitions').then(r => r.json()).then(setCompetitions).catch(() => {})
    fetch('/api/leaderboard/global').then(r => r.json()).then(d => setGlobalStats(d.stats)).catch(() => {})
    const interval = setInterval(() => {
      fetch('/api/competitions').then(r => r.json()).then(setCompetitions).catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  async function handleCreate() {
    if (!name.trim() || !displayName.trim()) return
    setLoading(true)
    try {
      const userId = `user_${Math.random().toString(36).slice(2, 9)}`
      localStorage.setItem('userId', userId)
      localStorage.setItem('displayName', displayName)

      const res = await fetch('/api/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, creatorId: userId, durationMinutes: duration }),
      })
      const comp = await res.json()

      await fetch(`/api/competitions/${comp.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, displayName }),
      })

      router.push(`/arena/${comp.id}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin(compId: string) {
    const dn = displayName || prompt('Enter your display name:') || 'Anon'
    setDisplayName(dn)

    let userId = localStorage.getItem('userId')
    if (!userId) {
      userId = `user_${Math.random().toString(36).slice(2, 9)}`
      localStorage.setItem('userId', userId)
    }
    localStorage.setItem('displayName', dn)

    await fetch(`/api/competitions/${compId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, displayName: dn }),
    })
    router.push(`/arena/${compId}`)
  }

  const active = competitions.filter(c => c.status === 'active')
  const ended = competitions.filter(c => c.status === 'ended')

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header style={{ background: 'var(--surface)', borderBottom: '2px solid #000', boxShadow: '0 4px 0px #000' }}
        className="px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Waves className="w-6 h-6" style={{ color: 'var(--teal)' }} />
            <span className="text-xl font-black tracking-tight" style={{ color: 'var(--teal)' }}>TIDAL</span>
            <span className="text-xl font-black tracking-tight text-white">WARS</span>
          </div>
          <div className="nb-btn nb-btn-ghost text-xs py-1 px-2 pointer-events-none" style={{ fontSize: '10px', letterSpacing: '0.1em' }}>
            <Zap className="w-2.5 h-2.5" /> TESTNET
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/leaderboard')} className="nb-btn nb-btn-ghost py-1.5 px-3 text-xs">
            <Trophy className="w-3 h-3" /> Hall of Fame
          </button>
          <WalletButton onConnected={(addr) => {
            if (!displayName) setDisplayName(addr.slice(0, 6) + '...' + addr.slice(-4))
          }} />
        </div>
      </header>

      {/* ── Live Price Ticker ────────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface-2)', borderBottom: '2px solid #000' }} className="overflow-hidden py-2 px-0">
        <div className="ticker-tape">
          {[...TICKER_SYMBOLS, ...TICKER_SYMBOLS].map((sym, i) => {
            const ticker = tickers[`${sym}-PERP`] ?? tickers[sym]
            const price = ticker?.markPrice || ticker?.lastPrice
            const change = ticker?.change24h ?? 0
            const fr = ticker?.fundingRate ?? 0
            return (
              <span key={i} className="inline-flex items-center gap-3 px-6 text-xs font-mono border-r"
                style={{ borderColor: '#1a2535' }}>
                <span className="font-black" style={{ color: 'var(--teal)' }}>{sym}</span>
                <span className="text-white font-bold">
                  {price ? `$${sym === 'BONK' ? price.toFixed(8) : price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                </span>
                {change !== 0 && (
                  <span style={{ color: change >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                    {change >= 0 ? '▲' : '▼'}{Math.abs(change).toFixed(2)}%
                  </span>
                )}
                {fr !== 0 && (
                  <span style={{ color: 'var(--text-muted)' }}>
                    FR:{fr >= 0 ? '+' : ''}{(fr * 100).toFixed(4)}%
                  </span>
                )}
              </span>
            )
          })}
        </div>
        <div className="flex items-center gap-1.5 px-4 mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          {wsConnected
            ? <><span className="live-dot-teal" /><span style={{ color: 'var(--teal)' }}>LIVE · Pacifica WebSocket</span></>
            : <><WifiOff className="w-3 h-3" /> REST prices</>}
          {wsConnected ? <Wifi className="w-3 h-3 ml-1" style={{ color: 'var(--teal)' }} /> : null}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="nb-card mb-4 p-6" style={{ borderColor: 'var(--teal)', boxShadow: 'var(--nb-shadow-teal)' }}>
            <div className="text-center">
              <div className="text-xs font-black tracking-[0.3em] mb-3" style={{ color: 'var(--teal)' }}>
                ≋ PVP PERPETUALS TRADING ON PACIFICA DEX ≋
              </div>
              <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-4" style={{
                textShadow: '4px 4px 0px #000, -1px -1px 0px var(--teal)'
              }}>
                <span style={{ color: 'var(--teal)' }}>TIDAL</span>
                <span className="text-white"> WARS</span>
              </h1>
              <p className="text-sm max-w-lg mx-auto mb-5" style={{ color: 'var(--text-muted)' }}>
                Create or join trading competitions. Connect your wallet, pick your instruments,
                set your leverage. Best PnL when the tide goes out wins.
              </p>
              {globalStats && (
                <div className="flex items-center justify-center gap-0 mx-auto max-w-xs">
                  {[
                    { label: 'Competitions', val: globalStats.totalCompetitions },
                    { label: 'Traders', val: globalStats.totalTraders },
                    { label: 'Trades', val: globalStats.globalTrades },
                  ].map(({ label, val }, i) => (
                    <div key={label} className="flex-1 py-3"
                      style={{ borderLeft: i === 0 ? '2px solid #000' : 'none', borderRight: '2px solid #000', borderTop: '2px solid #000', borderBottom: '2px solid #000', background: 'var(--surface-3)' }}>
                      <div className="text-lg font-black" style={{ color: 'var(--teal)' }}>{val.toLocaleString()}</div>
                      <div className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Create Competition ───────────────────────────────────────────── */}
        <div className="mb-10 nb-card p-5">
          <div className="text-xs font-black tracking-[0.2em] mb-4 pb-2" style={{ color: 'var(--teal)', borderBottom: '2px solid #000' }}>
            ≋ LAUNCH COMPETITION
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Your Name</label>
              <input
                className="nb-input"
                placeholder="e.g. OceanWhale"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Competition Name</label>
              <input
                className="nb-input"
                placeholder="e.g. Deep Sea Showdown"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Duration</label>
              <select className="nb-select" value={duration} onChange={e => setDuration(Number(e.target.value))}>
                {DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim() || !displayName.trim()}
            className="nb-btn nb-btn-primary w-full py-3 text-sm"
          >
            {loading ? '...' : '⚡ LAUNCH & ENTER ARENA'}
          </button>
        </div>

        {/* ── Active Competitions ──────────────────────────────────────────── */}
        {active.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="live-dot" />
              <span className="text-sm font-black tracking-widest uppercase" style={{ color: 'var(--profit)' }}>Live Competitions</span>
              <span className="text-xs font-bold px-2 py-0.5" style={{ background: 'var(--profit)', color: '#000', border: '2px solid #000' }}>
                {active.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {active.map(comp => <CompCard key={comp.id} comp={comp} onJoin={handleJoin} />)}
            </div>
          </div>
        )}

        {/* ── Ended Competitions ───────────────────────────────────────────── */}
        {ended.length > 0 && (
          <div className="opacity-60">
            <div className="text-sm font-black tracking-widest uppercase mb-4" style={{ color: 'var(--text-muted)' }}>
              Past Competitions
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ended.map(comp => <CompCard key={comp.id} comp={comp} onJoin={handleJoin} ended />)}
            </div>
          </div>
        )}

        {active.length === 0 && ended.length === 0 && (
          <div className="nb-card p-16 text-center">
            <Waves className="w-12 h-12 mx-auto mb-3 opacity-20" style={{ color: 'var(--teal)' }} />
            <p className="font-bold" style={{ color: 'var(--text-muted)' }}>No competitions yet.</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>Create the first one and set sail.</p>
          </div>
        )}

        {/* ── Tech footer ──────────────────────────────────────────────────── */}
        <div className="mt-12 pt-6 flex flex-wrap gap-3 justify-center"
          style={{ borderTop: '2px solid #000' }}>
          {[
            { label: 'Pacifica DEX', sub: 'Real orders on testnet' },
            { label: 'Ed25519 Signing', sub: 'Every order signed on-chain' },
            { label: 'Live WS Prices', sub: 'wss://test-ws.pacifica.fi' },
            { label: 'Builder Program', sub: 'Code: tidalwars' },
          ].map(t => (
            <div key={t.label} className="nb-btn-ghost nb-btn text-left flex-col items-start gap-0 py-2 px-3 text-xs pointer-events-none"
              style={{ letterSpacing: 0, textTransform: 'none' }}>
              <span className="font-black" style={{ color: 'var(--teal)', fontSize: '11px' }}>{t.label}</span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '10px' }}>{t.sub}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CompCard({ comp, onJoin, ended }: {
  comp: Competition
  onJoin: (id: string) => void
  ended?: boolean
}) {
  const count = Object.keys(comp.participants).length
  const timeLeft = Math.max(0, comp.endsAt - Date.now())
  const minutes = Math.floor(timeLeft / 60000)
  const seconds = Math.floor((timeLeft % 60000) / 1000)

  return (
    <div className="nb-card p-4 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#000] transition-all"
      style={{ boxShadow: 'var(--nb-shadow)' }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-black text-white text-sm">{comp.name}</h3>
          <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {count}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {ended ? 'Ended' : `${minutes}m ${seconds.toString().padStart(2, '0')}s`}
            </span>
          </div>
        </div>
        <span className="text-xs font-black px-2 py-1" style={
          ended
            ? { background: 'var(--surface-3)', color: 'var(--text-muted)', border: '2px solid #000' }
            : { background: 'var(--profit)', color: '#000', border: '2px solid #000' }
        }>
          {ended ? 'ENDED' : 'LIVE'}
        </span>
      </div>
      <div className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>$10,000 virtual USDC · up to 10x leverage</div>
      <button
        onClick={() => onJoin(comp.id)}
        disabled={!!ended}
        className={`nb-btn w-full py-2 text-xs ${ended ? 'nb-btn-ghost' : 'nb-btn-primary'}`}
      >
        {ended ? 'VIEW RESULTS' : '⚡ JOIN COMPETITION'}
      </button>
    </div>
  )
}
