'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Trophy, Swords, Clock, Users, TrendingUp, Zap } from 'lucide-react'
import { Competition } from '@/lib/types'

const DURATIONS = [
  { label: '1 min (test)', value: 1 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '4 hours', value: 240 },
]

export default function Home() {
  const router = useRouter()
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [duration, setDuration] = useState(30)
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/competitions').then(r => r.json()).then(setCompetitions).catch(() => {})
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

      // Auto-join as creator
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
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Swords className="text-blue-400 w-7 h-7" />
          <span className="text-xl font-bold text-white">PerpWars</span>
          <span className="text-xs text-gray-500 border border-gray-700 rounded px-2 py-0.5">on Pacifica</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span>Testnet</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-extrabold mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            PvP Perps Trading
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Compete in real-time perpetuals trading competitions on Pacifica DEX.
            Best PnL wins. No mercy.
          </p>
          <div className="flex items-center justify-center gap-6 mt-6 text-sm text-gray-500">
            <span className="flex items-center gap-1"><TrendingUp className="w-4 h-4 text-green-400" /> Live PnL tracking</span>
            <span className="flex items-center gap-1"><Trophy className="w-4 h-4 text-yellow-400" /> Ranked leaderboard</span>
            <span className="flex items-center gap-1"><Clock className="w-4 h-4 text-blue-400" /> Timed competitions</span>
          </div>
        </div>

        {/* Create Competition */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-10">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Swords className="w-5 h-5 text-blue-400" />
            Create a Competition
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Your name</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="e.g. SolanaWhale"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Competition name</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="e.g. Friday Night Perps"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Duration</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
              >
                {DURATIONS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={loading || !name.trim() || !displayName.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Creating...' : 'Create & Enter Arena'}
          </button>
        </div>

        {/* Active Competitions */}
        {active.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Live Competitions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {active.map(comp => (
                <CompetitionCard key={comp.id} comp={comp} onJoin={handleJoin} />
              ))}
            </div>
          </div>
        )}

        {/* Ended */}
        {ended.length > 0 && (
          <div>
            <h2 className="text-lg font-bold mb-4 text-gray-500">Past Competitions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60">
              {ended.map(comp => (
                <CompetitionCard key={comp.id} comp={comp} onJoin={handleJoin} ended />
              ))}
            </div>
          </div>
        )}

        {active.length === 0 && ended.length === 0 && (
          <div className="text-center text-gray-600 py-16">
            <Swords className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No competitions yet. Create the first one!</p>
          </div>
        )}
      </div>
    </div>
  )
}

function CompetitionCard({ comp, onJoin, ended }: {
  comp: Competition
  onJoin: (id: string) => void
  ended?: boolean
}) {
  const participantCount = Object.keys(comp.participants).length
  const timeLeft = Math.max(0, comp.endsAt - Date.now())
  const minutes = Math.floor(timeLeft / 60000)
  const seconds = Math.floor((timeLeft % 60000) / 1000)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-white">{comp.name}</h3>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" /> {participantCount} traders
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {ended ? 'Ended' : `${minutes}m ${seconds}s left`}
            </span>
          </div>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${ended ? 'bg-gray-800 text-gray-500' : 'bg-green-900/50 text-green-400'}`}>
          {ended ? 'Ended' : 'Live'}
        </span>
      </div>
      <div className="text-xs text-gray-500 mb-3">
        Starting balance: $10,000 virtual USDC
      </div>
      <button
        onClick={() => onJoin(comp.id)}
        disabled={ended}
        className="w-full bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm py-2 rounded-lg transition-colors"
      >
        {ended ? 'View Results' : 'Join Competition'}
      </button>
    </div>
  )
}
