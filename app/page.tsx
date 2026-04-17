'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Trophy, Clock, Users, Zap, Globe, Wifi, WifiOff, Waves, ChevronRight, Crown } from 'lucide-react'
import { Competition } from '@/lib/types'
import WalletButton from '@/components/WalletButton'
import OceanBubbles from '@/components/OceanBubbles'
import { usePacificaWs } from '@/lib/pacificaWs'

const DURATIONS = [
  { label: '1 min (test)', value: 1 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '4 hours', value: 240 },
]

const START_DELAYS = [
  { label: 'Start now',     value: 0 },
  { label: 'Lobby 1 min',   value: 60 },
  { label: 'Lobby 3 min',   value: 180 },
  { label: 'Lobby 5 min',   value: 300 },
  { label: 'Lobby 10 min',  value: 600 },
]

const TICKER_SYMBOLS = ['BTC', 'ETH', 'SOL', 'WIF', 'BONK']

export default function Home() {
  const router = useRouter()
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [name, setName] = useState('')
  const [duration, setDuration] = useState(30)
  const [startDelay, setStartDelay] = useState(0)
  const [displayName, setDisplayName] = useState('')
  const [creating, setCreating] = useState(false)
  const [globalStats, setGlobalStats] = useState<{ totalTraders: number; globalTrades: number; totalCompetitions: number } | null>(null)
  const [topCaptains, setTopCaptains] = useState<Array<{
    userId: string; displayName: string; totalPoints: number; wins: number; arenasEntered: number; bestRoi: number
    captain: { emoji: string; title: string }
  }>>([])

  const { tickers, wsConnected } = usePacificaWs()

  useEffect(() => {
    // Pre-fill display name from localStorage
    const saved = localStorage.getItem('displayName')
    if (saved) setDisplayName(saved)

    fetch('/api/competitions').then(r => r.json()).then(setCompetitions).catch(() => {})
    fetch('/api/leaderboard/global').then(r => r.json()).then(d => setGlobalStats(d.stats)).catch(() => {})
    fetch('/api/points/top').then(r => r.json()).then(d => setTopCaptains(d.captains ?? [])).catch(() => {})
    const interval = setInterval(() => {
      fetch('/api/competitions').then(r => r.json()).then(setCompetitions).catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  async function handleCreate() {
    if (!name.trim() || !displayName.trim()) return
    setCreating(true)
    try {
      const userId = `user_${Math.random().toString(36).slice(2, 9)}`
      localStorage.setItem('userId', userId)
      localStorage.setItem('displayName', displayName.trim())

      const res = await fetch('/api/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, creatorId: userId, durationMinutes: duration, startDelaySeconds: startDelay }),
      })
      const comp = await res.json()

      await fetch(`/api/competitions/${comp.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, displayName: displayName.trim() }),
      })

      router.push(`/arena/${comp.id}`)
    } finally {
      setCreating(false)
    }
  }

  // handleJoin: displayName='' means just view (for ended comps)
  async function handleJoin(compId: string, dn: string) {
    if (!dn) {
      router.push(`/arena/${compId}`)
      return
    }
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

  const active = competitions.filter(c => c.status === 'active' || c.status === 'waiting')
  const ended = competitions.filter(c => c.status === 'ended')

  return (
    <div className="min-h-screen ocean-depth relative">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header style={{ background: 'var(--surface)', borderBottom: '2px solid #000', boxShadow: '0 4px 0px #000' }}
        className="px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Waves className="w-6 h-6" style={{ color: 'var(--teal)' }} />
            <span className="text-xl font-black tracking-tight" style={{ color: 'var(--teal)' }}>TIDAL</span>
            <span className="text-xl font-black tracking-tight" style={{ color: 'var(--text)' }}>WARS</span>
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
      <div style={{ background: 'var(--surface-2)', borderBottom: '2px solid #000', borderTop: '1px solid var(--border-soft)' }} className="overflow-hidden">
        <div className="flex items-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 shrink-0 border-r" style={{ borderColor: '#000', background: 'var(--surface-3)' }}>
            {wsConnected
              ? <><span className="live-dot-teal" /><span className="text-xs font-black" style={{ color: 'var(--teal)' }}>LIVE</span></>
              : <><WifiOff className="w-3 h-3" style={{ color: 'var(--text-muted)' }} /><span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>REST</span></>
            }
          </div>
          <div className="overflow-hidden flex-1 py-1.5">
            <div className="ticker-tape">
              {[...TICKER_SYMBOLS, ...TICKER_SYMBOLS].map((sym, i) => {
                const ticker = tickers[`${sym}-PERP`] ?? tickers[sym]
                const price = ticker?.markPrice || ticker?.lastPrice
                const change = ticker?.change24h ?? 0
                const fr = ticker?.fundingRate ?? 0
                return (
                  <span key={i} className="inline-flex items-center gap-2 px-5 text-xs font-mono border-r"
                    style={{ borderColor: 'var(--border-soft)' }}>
                    <span className="font-black text-xs" style={{ color: 'var(--teal)' }}>{sym}</span>
                    <span className="font-bold" style={{ color: 'var(--text)' }}>
                      {price ? `$${sym === 'BONK' ? price.toFixed(8) : price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                    </span>
                    {change !== 0 && (
                      <span className="font-bold" style={{ color: change >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                        {change >= 0 ? '▲' : '▼'}{Math.abs(change).toFixed(2)}%
                      </span>
                    )}
                    {fr !== 0 && (
                      <span style={{ color: 'var(--text-muted)' }}>
                        FR{fr >= 0 ? '+' : ''}{(fr * 100).toFixed(3)}%
                      </span>
                    )}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="wave-divider" />

      <div className="max-w-5xl mx-auto px-6 py-10 relative">

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="nb-card-glow mb-4 p-8"
            style={{ borderColor: 'var(--teal)', boxShadow: 'var(--nb-shadow-teal)', position: 'relative', overflow: 'hidden' }}>
            <OceanBubbles count={12} />
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(0,216,245,0.12) 0%, transparent 70%)',
            }} />
            <div className="text-center relative">
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-5 text-xs font-black tracking-[0.2em]"
                style={{ background: 'var(--teal-bg)', border: '1px solid var(--teal)', color: 'var(--teal)' }}>
                <Waves className="w-3 h-3" /> PVP PERPETUALS · BUILT ON PACIFICA
              </div>
              <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-5 leading-none" style={{ textShadow: '4px 4px 0px #000' }}>
                <span style={{ color: 'var(--teal)' }}>TIDAL</span>
                <span style={{ color: 'var(--text)' }}>WARS</span>
              </h1>
              <p className="text-sm max-w-md mx-auto mb-6" style={{ color: 'var(--text-muted)', lineHeight: '1.7' }}>
                Real-time trading tournaments. Open positions with live Pacifica prices,
                battle other traders in timed arenas, climb the points ladder.
              </p>
              {globalStats && (
                <div className="flex items-stretch justify-center mx-auto max-w-sm border-2 border-black overflow-hidden" style={{ boxShadow: 'var(--nb-shadow)' }}>
                  {[
                    { label: 'Arenas', val: globalStats.totalCompetitions },
                    { label: 'Traders', val: globalStats.totalTraders },
                    { label: 'Trades', val: globalStats.globalTrades },
                  ].map(({ label, val }, i) => (
                    <div key={label} className="flex-1 py-3 px-2"
                      style={{
                        background: i === 1 ? 'var(--surface-3)' : 'var(--surface-2)',
                        borderRight: i < 2 ? '2px solid #000' : 'none',
                      }}>
                      <div className="text-2xl font-black tabular-nums" style={{ color: 'var(--teal)' }}>{val.toLocaleString()}</div>
                      <div className="text-xs font-bold uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Create Competition ───────────────────────────────────────────── */}
        <div className="mb-10 nb-card p-5" style={{ borderColor: 'var(--border-soft)', borderTopColor: 'var(--teal)', borderTopWidth: 3 }}>
          <div className="flex items-center justify-between gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid var(--border-soft)' }}>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" style={{ color: 'var(--teal)' }} />
              <span className="text-sm font-black tracking-[0.15em]" style={{ color: 'var(--teal)' }}>
                CREATE ARENA
              </span>
            </div>
            <span className="text-xs" style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
              $10k virtual · max 10× leverage
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
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
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Duration</label>
              <select className="nb-select" value={duration} onChange={e => setDuration(Number(e.target.value))}>
                {DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Start <span style={{ color: 'var(--gold)' }}>· lobby time</span>
              </label>
              <select className="nb-select" value={startDelay} onChange={e => setStartDelay(Number(e.target.value))}>
                {START_DELAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim() || !displayName.trim()}
            className="nb-btn nb-btn-primary w-full py-3 text-sm"
          >
            {creating ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin inline-block">◌</span> LAUNCHING...
              </span>
            ) : '⚡ LAUNCH & ENTER ARENA'}
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
              {active.map(comp => (
                <CompCard key={comp.id} comp={comp} onJoin={handleJoin} />
              ))}
            </div>
          </div>
        )}

        {/* ── Ended Competitions ───────────────────────────────────────────── */}
        {ended.length > 0 && (
          <div className="opacity-70">
            <div className="text-sm font-black tracking-widest uppercase mb-4" style={{ color: 'var(--text-muted)' }}>
              Past Competitions
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ended.map(comp => (
                <CompCard key={comp.id} comp={comp} onJoin={handleJoin} ended />
              ))}
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

        {/* ── How It Works ─────────────────────────────────────────────────── */}
        <div className="mt-16 mb-10">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 text-xs font-black tracking-[0.2em]"
              style={{ background: 'var(--teal-bg)', border: '1px solid var(--teal)', color: 'var(--teal)' }}>
              HOW IT WORKS
            </div>
            <h2 className="text-2xl md:text-3xl font-black" style={{ color: 'var(--text)' }}>
              Three steps. One winner.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                num: '01', title: 'JOIN AN ARENA',
                body: 'Create a room or jump into a live one. Durations from 1 minute to 4 hours — your call.',
                color: 'var(--teal)',
              },
              {
                num: '02', title: 'TRADE ON PACIFICA',
                body: 'Long or short five perpetuals with live on-chain prices. Up to 10× leverage.',
                color: 'var(--profit)',
              },
              {
                num: '03', title: 'CLIMB THE LADDER',
                body: 'Top PnL wins the arena. Earn Tidal Points that carry across every match you play.',
                color: 'var(--gold)',
              },
            ].map(step => (
              <div key={step.num} className="nb-card p-5 relative overflow-hidden"
                style={{ borderTopColor: step.color, borderTopWidth: 3 }}>
                <div className="text-5xl font-black mb-2" style={{ color: step.color, opacity: 0.2, letterSpacing: '-0.05em' }}>
                  {step.num}
                </div>
                <div className="text-sm font-black tracking-wider mb-2" style={{ color: step.color }}>{step.title}</div>
                <div className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{step.body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Hall of Captains (persistent points leaderboard) ──────────── */}
        {topCaptains.length > 0 && (
          <div className="mt-10 mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="w-4 h-4" style={{ color: 'var(--gold)' }} />
              <span className="text-sm font-black tracking-widest uppercase" style={{ color: 'var(--gold)' }}>Hall of Captains</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· Tidal Points leaderboard across all arenas</span>
            </div>
            <div className="nb-card overflow-hidden">
              {topCaptains.slice(0, 10).map((c, i) => (
                <div key={c.userId} className="flex items-center gap-3 px-4 py-2.5"
                  style={{
                    borderBottom: i < Math.min(9, topCaptains.length - 1) ? '2px solid #000' : undefined,
                    background: i === 0 ? 'rgba(255,215,0,0.04)' : undefined,
                  }}>
                  <span className="font-black text-sm w-6" style={{
                    color: i === 0 ? 'var(--gold)' : i === 1 ? '#9ca3af' : i === 2 ? '#b45309' : 'var(--text-muted)',
                  }}>#{i + 1}</span>
                  <span className="text-xl">{c.captain.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-sm truncate" style={{ color: 'var(--text)' }}>{c.displayName}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                      {c.captain.title} · {c.arenasEntered} arena{c.arenasEntered !== 1 ? 's' : ''}
                      {c.wins > 0 ? ` · 🏆 ${c.wins} win${c.wins !== 1 ? 's' : ''}` : ''}
                      {c.bestRoi > 0 ? ` · best ${c.bestRoi.toFixed(1)}% ROI` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black" style={{ color: 'var(--teal)' }}>
                      {c.totalPoints.toLocaleString()}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>points</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tech footer ──────────────────────────────────────────────────── */}
        <div className="mt-12 pt-6" style={{ borderTop: '2px solid #000' }}>
          <div className="text-xs font-black tracking-[0.2em] text-center mb-4" style={{ color: 'var(--text-muted)' }}>
            POWERED BY
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            {[
              { label: 'Pacifica DEX', sub: 'Ed25519 signed market orders', color: 'var(--teal)' },
              { label: 'Builder Program', sub: 'Code: tidalwars', color: 'var(--profit)' },
              { label: 'Live WS Prices', sub: 'wss://test-ws.pacifica.fi', color: 'var(--teal)' },
              { label: 'Privy Auth', sub: 'Embedded wallet login', color: 'var(--gold)' },
              { label: 'Fuul Analytics', sub: 'Events API tracking', color: 'var(--profit)' },
              { label: 'Elfa AI', sub: 'Trending token signals', color: 'var(--gold)' },
              { label: 'Upstash Redis', sub: 'Serverless persistence', color: 'var(--teal)' },
            ].map(t => (
              <div key={t.label} className="nb-btn-ghost nb-btn text-left flex-col items-start gap-0 py-2 px-3 text-xs pointer-events-none"
                style={{ letterSpacing: 0, textTransform: 'none' }}>
                <span className="font-black" style={{ color: t.color, fontSize: '11px' }}>{t.label}</span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '10px' }}>{t.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── CompCard ──────────────────────────────────────────────────────────────────

function CompCard({
  comp,
  onJoin,
  ended,
}: {
  comp: Competition
  onJoin: (id: string, displayName: string) => Promise<void>
  ended?: boolean
}) {
  const count = Object.keys(comp.participants).length
  const isWaiting = comp.status === 'waiting'
  const [now, setNow] = useState(Date.now())
  const [joining, setJoining] = useState(false)
  const [nameInput, setNameInput] = useState(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('displayName') ?? '') : ''
  )
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ended) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [ended])

  const timeLeft = isWaiting
    ? Math.max(0, comp.startsAt - now)
    : Math.max(0, comp.endsAt - now)

  const minutes = Math.floor(timeLeft / 60000)
  const seconds = Math.floor((timeLeft % 60000) / 1000)

  async function handleJoinClick() {
    if (joining) return
    const dn = nameInput.trim()
    if (!dn) {
      nameRef.current?.focus()
      nameRef.current?.select()
      return
    }
    setJoining(true)
    await onJoin(comp.id, dn)
    // navigation happens inside onJoin, component unmounts
  }

  return (
    <div className="nb-card hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#000] transition-all overflow-hidden"
      style={{
        boxShadow: 'var(--nb-shadow)',
        borderTopColor: ended ? 'var(--border-soft)' : 'var(--teal)',
        borderTopWidth: 3,
      }}>

      {/* Card header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-black text-sm leading-tight pr-2" style={{ color: 'var(--text)' }}>{comp.name}</h3>
          <span className="text-xs font-black px-2 py-0.5 shrink-0" style={
            ended
              ? { background: 'var(--surface-3)', color: 'var(--text-muted)', border: '1px solid var(--border-soft)' }
              : isWaiting
                ? { background: 'var(--gold)', color: '#000', border: '2px solid #000' }
                : { background: 'var(--profit)', color: '#000', border: '2px solid #000' }
          }>
            {ended ? 'ENDED' : isWaiting ? '⏳ LOBBY' : '● LIVE'}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1.5">
            <Users className="w-3 h-3" style={{ color: 'var(--teal)' }} />
            <span>{count} trader{count !== 1 ? 's' : ''}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" style={{ color: ended ? 'var(--text-muted)' : 'var(--gold)' }} />
            <span style={{ color: ended ? 'var(--text-muted)' : 'var(--gold)', fontWeight: 700 }}>
              {ended
                ? 'Ended'
                : isWaiting
                  ? `starts in ${minutes}m ${seconds.toString().padStart(2, '0')}s`
                  : timeLeft === 0 ? 'Ending...' : `${minutes}m ${seconds.toString().padStart(2, '0')}s`}
            </span>
          </span>
        </div>
      </div>

      <div className="px-4 pb-3 text-xs" style={{ color: 'var(--text-dim)', borderBottom: '2px solid #000' }}>
        $10,000 USDC virtual · max {comp.maxLeverage}x leverage · Pacifica testnet
      </div>

      {/* Join section */}
      <div className="p-3">
        {ended ? (
          /* VIEW RESULTS — always clickable */
          <button
            onClick={() => onJoin(comp.id, '')}
            className="nb-btn nb-btn-ghost w-full py-2.5 text-xs flex items-center justify-center gap-2"
          >
            <Trophy className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }} />
            VIEW RESULTS
            <ChevronRight className="w-3 h-3" />
          </button>
        ) : (
          /* JOIN form */
          <div className="flex flex-col gap-2">
            <div className="relative">
              <input
                ref={nameRef}
                type="text"
                className="nb-input text-xs"
                placeholder="Enter your name to join..."
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleJoinClick()}
                maxLength={20}
              />
              {nameInput.trim() && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold"
                  style={{ color: 'var(--teal)', pointerEvents: 'none' }}>
                  ✓
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleJoinClick}
                disabled={joining}
                className="nb-btn nb-btn-primary col-span-2 py-2.5 text-xs"
              >
                {joining ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin inline-block">◌</span> JOINING...
                  </span>
                ) : nameInput.trim() ? `⚡ JOIN AS ${nameInput.trim().toUpperCase().slice(0, 10)}` : '⚡ JOIN'}
              </button>
              <button
                onClick={() => onJoin(comp.id, '')}
                disabled={joining}
                className="nb-btn nb-btn-ghost py-2.5 text-xs flex items-center justify-center gap-1"
                title="Watch the arena without joining"
              >
                👁 WATCH
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
