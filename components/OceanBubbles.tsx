'use client'
import { useMemo } from 'react'

interface Bubble {
  left: string
  size: number
  duration: number
  delay: number
}

function makeBubbles(count: number): Bubble[] {
  return Array.from({ length: count }).map(() => ({
    left: `${Math.random() * 100}%`,
    size: 6 + Math.random() * 18,
    duration: 14 + Math.random() * 18,
    delay: -Math.random() * 25,
  }))
}

/**
 * Subtle rising bubbles effect — ocean atmosphere. Absolutely positioned
 * inside a relatively-positioned parent. Low opacity so it doesn't distract.
 */
export default function OceanBubbles({ count = 14 }: { count?: number }) {
  const bubbles = useMemo(() => makeBubbles(count), [count])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {bubbles.map((b, i) => (
        <span
          key={i}
          className="bubble"
          style={{
            left: b.left,
            width: `${b.size}px`,
            height: `${b.size}px`,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
    </div>
  )
}
