'use client'
import { useEffect, useState } from 'react'
import { X, Lock, Check, Sparkles } from 'lucide-react'
import { SHIPS, getActiveShip, setActiveShip, isUnlocked } from '@/lib/shipShop'

interface Props {
  isOpen: boolean
  onClose: () => void
  userId: string
}

export default function ShipShop({ isOpen, onClose, userId }: Props) {
  const [totalPoints, setTotalPoints] = useState(0)
  const [activeEmoji, setActiveEmojiState] = useState<string>(getActiveShip())

  useEffect(() => {
    if (!isOpen || !userId) return
    fetch(`/api/points/${userId}`).then(r => r.json())
      .then(d => setTotalPoints(d.totalPoints ?? 0))
      .catch(() => {})
  }, [isOpen, userId])

  useEffect(() => {
    if (isOpen) setActiveEmojiState(getActiveShip())
  }, [isOpen])

  if (!isOpen) return null

  function equip(emoji: string) {
    setActiveShip(emoji)
    setActiveEmojiState(emoji)
  }

  return (
    <div className="fixed inset-0 z-[195] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }} onClick={onClose}>
      <div className="nb-card max-w-2xl w-full overflow-hidden"
        style={{ borderColor: 'var(--teal)', borderWidth: 3, boxShadow: '6px 6px 0px #000', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-3"
          style={{ background: 'var(--teal)', borderBottom: '2px solid #000' }}>
          <div className="flex items-center gap-2 font-black" style={{ color: '#000' }}>
            <Sparkles className="w-4 h-4" />
            <span className="tracking-widest">SHIP SHOP</span>
          </div>
          <button onClick={onClose} className="nb-btn nb-btn-ghost py-1 px-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-5 py-3 flex items-center justify-between"
          style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-soft)' }}>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Unlocked by reaching Tidal Points thresholds. No spending — permanent unlocks.
          </div>
          <div className="text-xs font-black font-mono" style={{ color: 'var(--teal)' }}>
            {totalPoints.toLocaleString()} PTS
          </div>
        </div>

        <div className="p-4 overflow-y-auto" style={{ maxHeight: '70vh' }}>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {SHIPS.map(ship => {
              const unlocked = isUnlocked(ship, totalPoints)
              const equipped = ship.emoji === activeEmoji
              return (
                <button key={ship.id}
                  onClick={() => unlocked && equip(ship.emoji)}
                  disabled={!unlocked}
                  className="relative flex flex-col items-center p-3 text-center transition-all"
                  style={{
                    background: equipped ? 'rgba(0,216,245,0.12)' : 'var(--surface-2)',
                    border: `2px solid ${equipped ? 'var(--teal)' : unlocked ? 'var(--border-soft)' : 'var(--surface-3)'}`,
                    boxShadow: equipped ? '4px 4px 0px #000' : '2px 2px 0px #000',
                    cursor: unlocked ? 'pointer' : 'not-allowed',
                    opacity: unlocked ? 1 : 0.45,
                  }}
                  title={unlocked ? ship.description : `Locked · reach ${ship.minPoints} pts to unlock`}>
                  {equipped && (
                    <div className="absolute top-1 right-1">
                      <Check className="w-3.5 h-3.5" style={{ color: 'var(--teal)' }} />
                    </div>
                  )}
                  {!unlocked && (
                    <div className="absolute top-1 right-1">
                      <Lock className="w-3 h-3" style={{ color: 'var(--text-dim)' }} />
                    </div>
                  )}
                  <div className="text-3xl mb-1" style={{ filter: unlocked ? 'none' : 'grayscale(1)' }}>
                    {ship.emoji}
                  </div>
                  <div className="text-xs font-black tracking-wider" style={{
                    color: equipped ? 'var(--teal)' : unlocked ? 'var(--text)' : 'var(--text-dim)',
                    fontSize: '10px', lineHeight: 1.2,
                  }}>
                    {ship.name.toUpperCase()}
                  </div>
                  <div className="text-xs mt-0.5" style={{
                    color: unlocked ? 'var(--text-muted)' : 'var(--text-dim)',
                    fontSize: '9px',
                  }}>
                    {ship.minPoints === 0 ? 'FREE' : `${ship.minPoints.toLocaleString()} pts`}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-4 pt-3 text-xs text-center"
            style={{ color: 'var(--text-dim)', borderTop: '1px solid var(--border-soft)', fontSize: '10px' }}>
            Ship shown to other players in OceanBattle when you trade. Earn points by placing in arenas.
          </div>
        </div>
      </div>
    </div>
  )
}
