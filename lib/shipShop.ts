/**
 * Ship Shop — cosmetic ship emoji customization unlocked by Tidal Points.
 *
 * Unlock mechanic: each ship has `minPoints`. User can "equip" any ship
 * whose threshold they've reached. No spending — points are persistent
 * progression, not currency. Ship choice stored in localStorage.
 *
 * When a user selects a ship, it's rendered in OceanBattle for their
 * own boat only. Other players still see default PnL-tier emoji.
 */

export interface Ship {
  id: string
  emoji: string
  name: string
  description: string
  minPoints: number
}

export const SHIPS: Ship[] = [
  { id: 'sailboat',   emoji: '⛵',   name: 'Sailboat',         description: 'The starter. Catches the wind, catches the tide.',       minPoints: 0 },
  { id: 'rowboat',    emoji: '🚣',   name: 'Rowboat',          description: 'Humble. You paddle your own destiny.',                    minPoints: 0 },
  { id: 'canoe',      emoji: '🛶',   name: 'Canoe',            description: 'Minimal. Maximum skill.',                                 minPoints: 50 },
  { id: 'speedboat',  emoji: '🛥️',   name: 'Speedboat',        description: 'Fast entries, faster exits.',                             minPoints: 100 },
  { id: 'fishing',    emoji: '🎣',   name: 'Fishing Charter',  description: 'Patient. Waits for the right catch.',                     minPoints: 200 },
  { id: 'ferry',      emoji: '⛴️',   name: 'Ferry',            description: 'Reliable. Brings everyone along for the ride.',           minPoints: 300 },
  { id: 'freighter',  emoji: '🚢',   name: 'Freighter',        description: 'Heavy cargo. Moves markets.',                             minPoints: 500 },
  { id: 'anchor',     emoji: '⚓',   name: "Admiral's Anchor", description: 'Never drift again. Unlocks Captain tier and above.',     minPoints: 800 },
  { id: 'wave',       emoji: '🌊',   name: 'Living Wave',      description: 'You ARE the ocean.',                                      minPoints: 1500 },
  { id: 'shark',      emoji: '🦈',   name: 'Shark',            description: 'Apex predator. Smells PnL blood in the water.',           minPoints: 2500 },
  { id: 'whale',      emoji: '🐋',   name: 'Whale',            description: 'Commands attention. Moves the sea when you surface.',    minPoints: 4000 },
  { id: 'dolphin',    emoji: '🐬',   name: 'Pod Leader',       description: 'Intelligent. Social. Unbeatable.',                        minPoints: 6000 },
  { id: 'kraken',     emoji: '🐙',   name: 'Kraken',           description: 'Legendary. Drags entire arenas into the deep.',           minPoints: 10000 },
]

export const DEFAULT_SHIP = SHIPS[0]

const SHIP_KEY = 'tw_active_ship'

export function getActiveShip(): string {
  if (typeof window === 'undefined') return DEFAULT_SHIP.emoji
  try {
    const stored = localStorage.getItem(SHIP_KEY)
    if (stored) return stored
  } catch { /* quota / SSR */ }
  return DEFAULT_SHIP.emoji
}

export function setActiveShip(emoji: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SHIP_KEY, emoji)
    // Broadcast so OceanBattle picks it up without reload
    window.dispatchEvent(new Event('ship-changed'))
  } catch { /* ignore */ }
}

export function shipByEmoji(emoji: string): Ship | undefined {
  return SHIPS.find(s => s.emoji === emoji)
}

export function isUnlocked(ship: Ship, totalPoints: number): boolean {
  return totalPoints >= ship.minPoints
}
