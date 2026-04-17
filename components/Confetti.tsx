'use client'
import { useEffect, useState } from 'react'

interface Particle {
  id: number
  left: string
  color: string
  emoji: string
  delay: number
  duration: number
  rotate: number
}

const COLORS = ['var(--teal)', 'var(--profit)', 'var(--gold)', 'var(--loss)']
const EMOJIS = ['🌊', '🐋', '🦈', '🏆', '💎', '🪙', '🐙']

function generate(count: number): Particle[] {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    emoji: Math.random() < 0.3 ? EMOJIS[Math.floor(Math.random() * EMOJIS.length)] : '',
    delay: Math.random() * 0.4,
    duration: 1.6 + Math.random() * 1.2,
    rotate: Math.random() * 720 - 360,
  }))
}

/**
 * Confetti burst — mounts, plays for ~3s, unmounts when done.
 * Pure CSS animation, no library. Mixes colored squares and ocean emojis.
 */
export default function Confetti({ trigger, count = 60 }: { trigger: boolean; count?: number }) {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    if (!trigger) return
    setParticles(generate(count))
    const t = setTimeout(() => setParticles([]), 3500)
    return () => clearTimeout(t)
  }, [trigger, count])

  if (particles.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-[180] overflow-hidden" aria-hidden>
      {particles.map(p => (
        <div key={p.id}
          className="absolute"
          style={{
            left: p.left,
            top: '-40px',
            width: p.emoji ? 'auto' : '10px',
            height: p.emoji ? 'auto' : '10px',
            background: p.emoji ? 'transparent' : p.color,
            color: p.color,
            fontSize: p.emoji ? '20px' : undefined,
            border: p.emoji ? 'none' : '1px solid #000',
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
            transform: `rotate(${p.rotate}deg)`,
          }}>
          {p.emoji}
        </div>
      ))}
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
