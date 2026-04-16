export interface Achievement {
  id: string
  emoji: string
  title: string
  description: string
}

export const ACHIEVEMENTS: Record<string, Achievement> = {
  first_blood:     { id: 'first_blood',     emoji: '🩸', title: 'First Blood',     description: 'Opened your first position in this arena' },
  whale_size:      { id: 'whale_size',      emoji: '🐋', title: 'Whale Size',      description: 'Opened a position with notional > $10,000' },
  max_leverage:    { id: 'max_leverage',    emoji: '⚡', title: 'All-In',          description: 'Used the arena max leverage on a position' },
  winning_close:   { id: 'winning_close',   emoji: '🏆', title: 'Winning Close',   description: 'Closed a position in profit' },
  big_win:         { id: 'big_win',         emoji: '💎', title: 'Diamond Hands',   description: 'Closed a single position for >$100 profit' },
  whale_hunt:      { id: 'whale_hunt',      emoji: '🦈', title: 'Shark Attack',    description: 'Closed with >5% ROI on a position' },
  quick_draw:      { id: 'quick_draw',      emoji: '🎯', title: 'Quick Draw',      description: 'Opened and closed within 60 seconds' },
  trending_trade:  { id: 'trending_trade',  emoji: '🔥', title: 'Ride the Wave',   description: 'Opened a position on an Elfa-trending token' },
  tide_rider:      { id: 'tide_rider',      emoji: '🌊', title: 'Tide Rider',      description: 'Held a position through a ±1% price move' },
  chatter:         { id: 'chatter',         emoji: '💬', title: 'Chatter',         description: 'Sent 5+ chat messages in one arena' },
  kraken_tier:     { id: 'kraken_tier',     emoji: '🐙', title: 'Kraken Tier',     description: 'Reached >10% ROI — top of the food chain' },
}

export function loadUnlocked(arenaId: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(`ach:${arenaId}`)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch { return new Set() }
}

export function saveUnlocked(arenaId: string, set: Set<string>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(`ach:${arenaId}`, JSON.stringify(Array.from(set)))
  } catch { /* quota — ignore */ }
}
