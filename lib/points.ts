import { kget, kset, kzadd, kzrevrange } from './kv'

export interface TidalPoints {
  userId: string
  displayName: string
  walletAddress?: string
  totalPoints: number
  wins: number
  runnerUps: number       // 2nd place finishes
  arenasEntered: number
  bestRoi: number         // best single-arena ROI %
  totalPnl: number        // cumulative realized PnL across arenas
  updatedAt: number
}

export interface Captain { title: string; emoji: string; minPoints: number }

export const CAPTAIN_TIERS: Captain[] = [
  { title: 'Rookie',      emoji: '🌱',  minPoints: 0 },
  { title: 'Sailor',      emoji: '⛵',  minPoints: 100 },
  { title: 'Navigator',   emoji: '🧭',  minPoints: 300 },
  { title: 'Captain',     emoji: '⚓',  minPoints: 800 },
  { title: 'Commodore',   emoji: '🎖️',  minPoints: 1800 },
  { title: 'Admiral',     emoji: '🏴‍☠️', minPoints: 4000 },
  { title: 'Legend',      emoji: '👑',  minPoints: 10000 },
]

export function captainFor(points: number): Captain {
  return [...CAPTAIN_TIERS].reverse().find(t => points >= t.minPoints) ?? CAPTAIN_TIERS[0]
}

/**
 * Points formula per arena settle (encourages participation AND performance):
 *   base = 10 (show up)
 *   rank bonus: 1st=100, 2nd=50, 3rd=25, others=5
 *   roi bonus: max(0, floor(roi * 10))  → +10 per 1% ROI (caps at soft-limit)
 *   win streak: future bonus
 */
export function computeArenaPoints(params: {
  rank: number
  totalParticipants: number
  roi: number
}): number {
  const { rank, roi } = params
  const base = 10
  const rankBonus = rank === 1 ? 100 : rank === 2 ? 50 : rank === 3 ? 25 : 5
  const roiBonus = Math.max(0, Math.floor(roi * 10))
  return base + rankBonus + Math.min(500, roiBonus)
}

const POINTS_KEY = 'tidal_points'
const LEADERBOARD_KEY = 'tidal_points_leaderboard'

export async function getPoints(userId: string): Promise<TidalPoints | null> {
  // Upstash Redis auto-deserializes JSON so raw may already be an object
  const raw = await kget<unknown>(`${POINTS_KEY}:${userId}`)
  if (!raw) return null
  if (typeof raw === 'object') return raw as TidalPoints
  try { return JSON.parse(raw as string) as TidalPoints } catch { return null }
}

export async function addPointsResult(params: {
  userId: string
  displayName: string
  walletAddress?: string
  rank: number
  totalParticipants: number
  roi: number
  pnl: number
}): Promise<{ earned: number; totals: TidalPoints }> {
  const earned = computeArenaPoints(params)
  const current = (await getPoints(params.userId)) ?? {
    userId: params.userId, displayName: params.displayName, walletAddress: params.walletAddress,
    totalPoints: 0, wins: 0, runnerUps: 0, arenasEntered: 0, bestRoi: 0, totalPnl: 0, updatedAt: Date.now(),
  }
  const next: TidalPoints = {
    ...current,
    displayName: params.displayName,
    walletAddress: params.walletAddress ?? current.walletAddress,
    totalPoints: current.totalPoints + earned,
    wins: current.wins + (params.rank === 1 ? 1 : 0),
    runnerUps: current.runnerUps + (params.rank === 2 ? 1 : 0),
    arenasEntered: current.arenasEntered + 1,
    bestRoi: Math.max(current.bestRoi, params.roi),
    totalPnl: current.totalPnl + params.pnl,
    updatedAt: Date.now(),
  }
  // Pass object directly — Upstash handles JSON serialization
  await Promise.all([
    kset(`${POINTS_KEY}:${params.userId}`, next, 60 * 60 * 24 * 90),
    kzadd(LEADERBOARD_KEY, next.totalPoints, params.userId),
  ])
  return { earned, totals: next }
}

export async function getTopCaptains(limit = 10): Promise<TidalPoints[]> {
  const top = await kzrevrange(LEADERBOARD_KEY, 0, limit - 1)
  if (top.length === 0) return []
  const records = await Promise.all(top.map(({ member }) => getPoints(member)))
  return records.filter((r): r is TidalPoints => r !== null)
}
