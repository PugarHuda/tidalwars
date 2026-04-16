'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Trophy, Users, Activity, Zap, ArrowLeft, BarChart2,
  TrendingUp, Clock, Medal, Waves,
} from 'lucide-react'

interface GlobalEntry {
  rank: number
  userId: string
  displayName: string
  totalPnl: number
  avgRoi: number
  competitions: number
  wins: number
  bestRoi: number
  totalVolume: number
  totalTrades: number
}

interface CompSummary {
  id: string
  name: string
  status: string
  participantCount: number
  endsAt: number
  durationMinutes: number
  createdAt: number
  winner: { displayName: string; realizedPnl: number } | null
}

interface GlobalData {
  leaderboard: GlobalEntry[]
  stats: {
    totalCompetitions: number
    activeCompetitions: number
    totalTraders: number
    globalVolume: number
    globalTrades: number
  }
  competitions: CompSummary[]
}

function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

const STAT_COLORS = [
  { bg: 'var(--gold)', color: '#000' },
  { bg: 'var(--profit)', color: '#000' },
  { bg: 'var(--teal)', color: '#000' },
  { bg: '#a855f7', color: '#fff' },
  { bg: '#ec4899', color: '#fff' },
]

export default function LeaderboardPage() {
  const router = useRouter()
  const [data, setData] = useState<GlobalData | null>(null)
  const [tab, setTab] = useState<'traders' | 'competitions'>('traders')

  useEffect(() => {
    const load = () =>
      fetch('/api/leaderboard/global').then(r => r.json()).then(setData).catch(() => {})
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [])

  const active = data?.competitions.filter(c => c.status === 'active') ?? []
  const ended = data?.competitions.filter(c => c.status === 'ended') ?? []
  const s = data?.stats

  return (
    <div className="min-h-screen text-white" style={{ background: 'var(--bg)' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header style={{ background: 'var(--surface)', borderBottom: '2px solid #000', boxShadow: '0 4px 0px #000' }}
        className="px-6 py-3 flex items-center gap-4 sticky top-0 z-50">
        <button onClick={() => router.push('/')} className="nb-btn nb-btn-ghost py-1.5 px-2">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <Waves className="w-5 h-5" style={{ color: 'var(--teal)' }} />
          <span className="text-lg font-black tracking-tight" style={{ color: 'var(--teal)' }}>TIDAL</span>
          <span className="text-lg font-black">WARS</span>
          <span className="font-black text-lg mx-1" style={{ color: 'var(--text-muted)' }}>/</span>
          <span className="font-black text-sm tracking-wider">HALL OF FAME</span>
        </div>
        <div className="ml-auto">
          <div className="nb-btn nb-btn-ghost text-xs py-1 px-2 pointer-events-none" style={{ fontSize: '10px' }}>
            <Zap className="w-2.5 h-2.5" /> TESTNET
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* ── Global Stats ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-0 mb-8 border-2 border-black" style={{ boxShadow: 'var(--nb-shadow)' }}>
          {[
            { label: 'Competitions', value: s?.totalCompetitions ?? 0, icon: Trophy },
            { label: 'Live Now', value: s?.activeCompetitions ?? 0, icon: Activity, live: true },
            { label: 'Traders', value: s?.totalTraders ?? 0, icon: Users },
            { label: 'Total Trades', value: s?.globalTrades ?? 0, icon: BarChart2 },
            { label: 'Volume', value: fmtUsd(s?.globalVolume ?? 0), icon: TrendingUp, raw: true },
          ].map(({ label, value, icon: Icon, live, raw }, i) => (
            <div key={label} className="p-4 text-center"
              style={{
                background: STAT_COLORS[i].bg,
                color: STAT_COLORS[i].color,
                borderRight: i < 4 ? '2px solid #000' : undefined,
              }}>
              <div className="flex justify-center mb-1">
                <Icon className={`w-4 h-4 ${live ? 'animate-pulse' : ''}`} />
              </div>
              <div className="text-xl font-black">{raw ? value : (typeof value === 'number' ? value.toLocaleString() : value)}</div>
              <div className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* ── Main leaderboard ─────────────────────────────────────── */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="flex gap-0 mb-4 border-2 border-black" style={{ boxShadow: 'var(--nb-shadow)' }}>
              {(['traders', 'competitions'] as const).map((t, i) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="flex-1 py-2.5 font-black text-sm uppercase tracking-wider transition-colors"
                  style={tab === t
                    ? { background: 'var(--teal)', color: '#000', borderRight: i === 0 ? '2px solid #000' : undefined }
                    : { background: 'var(--surface)', color: 'var(--text-muted)', borderRight: i === 0 ? '2px solid #000' : undefined }
                  }
                >
                  {t === 'traders' ? `Traders (${data?.leaderboard.length ?? 0})` : `Battles (${data?.competitions.length ?? 0})`}
                </button>
              ))}
            </div>

            {tab === 'traders' ? (
              <div className="nb-card overflow-hidden">
                {!data ? (
                  <div className="text-center py-16 font-bold" style={{ color: 'var(--text-muted)' }}>Loading...</div>
                ) : data.leaderboard.length === 0 ? (
                  <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                    <Medal className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-bold">No completed competitions yet</p>
                    <button onClick={() => router.push('/')} className="nb-btn nb-btn-primary mt-4 text-xs py-2 px-4">
                      Create the first one
                    </button>
                  </div>
                ) : (
                  data.leaderboard.slice(0, 25).map((entry, i) => (
                    <div key={entry.userId}
                      className="flex items-center gap-4 px-5 py-3.5 hover:brightness-110 transition-all"
                      style={{
                        borderBottom: '2px solid #000',
                        background: i === 0 ? 'rgba(255,215,0,0.08)' : i === 1 ? 'rgba(200,200,200,0.05)' : i === 2 ? 'rgba(180,120,50,0.05)' : undefined,
                      }}
                    >
                      <div className="w-8 text-center font-black text-lg">
                        {MEDAL[i + 1] ?? <span className="text-sm" style={{ color: 'var(--text-muted)' }}>#{entry.rank}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-white truncate">{entry.displayName}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {entry.competitions} comp{entry.competitions !== 1 ? 's' : ''}
                          {entry.wins > 0 && <span className="ml-2" style={{ color: 'var(--gold)' }}>🏆 {entry.wins}W</span>}
                          {entry.totalTrades > 0 && <span className="ml-2">{entry.totalTrades} trades</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-sm" style={{ color: entry.totalPnl >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                          {entry.totalPnl >= 0 ? '+' : ''}{entry.totalPnl.toFixed(2)} USDC
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          avg {entry.avgRoi >= 0 ? '+' : ''}{entry.avgRoi.toFixed(1)}% · best {entry.bestRoi.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {data?.competitions.length === 0 ? (
                  <div className="nb-card text-center py-16 font-bold" style={{ color: 'var(--text-muted)' }}>No competitions yet</div>
                ) : (
                  data?.competitions
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .map(c => {
                      const minsLeft = Math.max(0, Math.floor((c.endsAt - Date.now()) / 60000))
                      return (
                        <div key={c.id} onClick={() => router.push(`/arena/${c.id}`)}
                          className="nb-card p-4 cursor-pointer hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#000] transition-all">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-black text-white">{c.name}</div>
                              <div className="text-xs mt-1 flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
                                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {c.participantCount}</span>
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {c.durationMinutes}m</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-black px-2 py-1" style={
                                c.status === 'active'
                                  ? { background: 'var(--profit)', color: '#000', border: '2px solid #000' }
                                  : { background: 'var(--surface-3)', color: 'var(--text-muted)', border: '2px solid #000' }
                              }>
                                {c.status === 'active' ? `${minsLeft}m LEFT` : 'ENDED'}
                              </span>
                              {c.winner && (
                                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                  🏆 {c.winner.displayName}
                                  <span className="ml-1 font-black" style={{ color: c.winner.realizedPnl >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                                    {c.winner.realizedPnl >= 0 ? '+' : ''}{c.winner.realizedPnl.toFixed(2)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                )}
              </div>
            )}
          </div>

          {/* ── Right sidebar ────────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Live Now */}
            <div className="nb-card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '2px solid #000', background: 'var(--surface-2)' }}>
                <span className="live-dot" />
                <span className="text-xs font-black tracking-widest uppercase" style={{ color: 'var(--profit)' }}>Live Now</span>
              </div>
              {active.length === 0 ? (
                <div className="p-5 text-center">
                  <div className="text-sm mb-3 font-bold" style={{ color: 'var(--text-muted)' }}>No active battles</div>
                  <button onClick={() => router.push('/')} className="nb-btn nb-btn-primary text-xs py-2">
                    Start One →
                  </button>
                </div>
              ) : (
                <div>
                  {active.map(c => {
                    const minsLeft = Math.max(0, Math.floor((c.endsAt - Date.now()) / 60000))
                    const secsLeft = Math.floor(((c.endsAt - Date.now()) % 60000) / 1000)
                    return (
                      <div key={c.id} className="p-4" style={{ borderBottom: '2px solid #000' }}>
                        <div className="flex justify-between mb-1">
                          <div className="font-black text-sm">{c.name}</div>
                          <div className="font-black font-mono text-sm" style={{ color: 'var(--profit)' }}>
                            {minsLeft}:{secsLeft.toString().padStart(2, '0')}
                          </div>
                        </div>
                        <div className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{c.participantCount} traders</div>
                        <button onClick={() => router.push(`/arena/${c.id}`)} className="nb-btn nb-btn-primary w-full py-2 text-xs">
                          ENTER ARENA
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Recent Results */}
            {ended.length > 0 && (
              <div className="nb-card overflow-hidden">
                <div className="px-4 py-3 text-xs font-black tracking-widest uppercase" style={{ borderBottom: '2px solid #000', background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                  Recent Results
                </div>
                {ended.slice(0, 5).map((c, i) => (
                  <div key={c.id} onClick={() => router.push(`/arena/${c.id}`)}
                    className="px-4 py-3 cursor-pointer hover:brightness-110"
                    style={{ borderBottom: i < 4 ? '2px solid #000' : undefined }}>
                    <div className="font-bold text-sm text-white">{c.name}</div>
                    {c.winner ? (
                      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        🏆 <span className="text-white font-bold">{c.winner.displayName}</span>
                        <span className="ml-2 font-black" style={{ color: c.winner.realizedPnl >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                          {c.winner.realizedPnl >= 0 ? '+' : ''}{c.winner.realizedPnl.toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <div className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>No participants</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Tech stack badge */}
            <div className="nb-card p-4" style={{ borderColor: 'var(--teal)', boxShadow: 'var(--nb-shadow-teal)' }}>
              <div className="text-xs font-black tracking-[0.2em] mb-3" style={{ color: 'var(--teal)' }}>≋ POWERED BY</div>
              {[
                'Pacifica DEX · Testnet',
                'Ed25519 Order Signing',
                'Real-time WebSocket Feed',
                'Builder Code: tidalwars',
                'Privy Wallet Auth',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1.5" style={{ borderBottom: i < 4 ? '1px solid #1a2535' : undefined }}>
                  <span className="w-2 h-2 flex-shrink-0" style={{ background: ['var(--teal)', 'var(--profit)', 'var(--gold)', '#a855f7', '#ec4899'][i], border: '1px solid #000' }} />
                  <span style={{ color: 'var(--text-muted)' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
