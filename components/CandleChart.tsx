'use client'
import { memo, useEffect, useRef, useState } from 'react'

export interface Candle {
  t: number; T: number
  o: number; c: number; h: number; l: number
  v: number; n: number
}

interface Props {
  symbol: string
  currentPrice: number
  entryPrices?: { price: number; side: 'bid' | 'ask' }[]
  interval?: string
  limit?: number
}

/**
 * Polls /api/pacifica/kline every 15s for the selected symbol/interval.
 * Cancels on unmount, re-fetches when symbol or interval changes.
 */
function useCandles(symbol: string, interval: string, limit: number) {
  const [candles, setCandles] = useState<Candle[]>([])
  const [loading, setLoading] = useState(false)
  const cancelRef = useRef(false)

  useEffect(() => {
    cancelRef.current = false
    setLoading(true)

    const fetchCandles = async () => {
      try {
        const res = await fetch(`/api/pacifica/kline?symbol=${symbol}&interval=${interval}&limit=${limit}`)
        if (!res.ok || cancelRef.current) return
        const data = await res.json()
        if (!cancelRef.current && Array.isArray(data.candles)) {
          setCandles(data.candles)
        }
      } catch { /* silent */ }
      finally { if (!cancelRef.current) setLoading(false) }
    }

    fetchCandles()
    const id = setInterval(fetchCandles, 15_000)
    return () => { cancelRef.current = true; clearInterval(id) }
  }, [symbol, interval, limit])

  return { candles, loading }
}

export const CandleChart = memo(function CandleChart({
  symbol, currentPrice, entryPrices = [], interval = '1m', limit = 60,
}: Props) {
  const [selectedInterval, setSelectedInterval] = useState(interval)
  const { candles, loading } = useCandles(symbol, selectedInterval, limit)

  const W = 480, H = 140, PAD_X = 8, PAD_Y = 10, LABEL_W = 40

  // Empty state
  if (candles.length === 0) {
    return (
      <div style={{ borderBottom: '2px solid #000', background: 'var(--surface-2)' }}>
        <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--border-soft)' }}>
          <div className="text-xs font-black tracking-widest" style={{ color: 'var(--teal)' }}>
            📊 {symbol} · {selectedInterval} candles
          </div>
          <IntervalSelector value={selectedInterval} onChange={setSelectedInterval} />
        </div>
        <div className="flex items-center justify-center py-8 text-xs font-black tracking-widest" style={{ color: 'var(--text-dim)' }}>
          {loading ? 'LOADING PACIFICA CANDLES...' : 'NO CANDLE DATA'}
        </div>
      </div>
    )
  }

  // Scales
  const allPrices = [
    ...candles.flatMap(c => [c.h, c.l]),
    ...entryPrices.map(e => e.price),
    currentPrice,
  ].filter(p => p > 0)
  const minP = Math.min(...allPrices)
  const maxP = Math.max(...allPrices)
  const range = maxP - minP || maxP * 0.001 // avoid div0 when all prices equal
  const pad = range * 0.05

  const chartW = W - LABEL_W - PAD_X * 2
  const chartH = H - PAD_Y * 2
  const candleW = Math.max(2, (chartW / candles.length) * 0.7)
  const step = chartW / candles.length

  const yFor = (p: number) =>
    PAD_Y + (1 - (p - (minP - pad)) / (range + pad * 2)) * chartH

  const xFor = (i: number) => PAD_X + step * i + step / 2

  return (
    <div style={{ borderBottom: '2px solid #000', background: 'var(--surface-2)', position: 'relative' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--border-soft)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-black tracking-widest" style={{ color: 'var(--teal)' }}>
            📊 {symbol}
          </span>
          <span className="text-xs px-1.5 py-0.5 font-black" style={{
            background: 'var(--surface-3)', border: '1px solid var(--border-soft)',
            color: 'var(--text-muted)', fontSize: '9px',
          }}>
            {candles.length} × {selectedInterval}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-dim)', fontSize: '10px' }}>
            Pacifica /kline
          </span>
        </div>
        <IntervalSelector value={selectedInterval} onChange={setSelectedInterval} />
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
        {/* Horizontal grid lines at 25%, 50%, 75% */}
        {[0.25, 0.5, 0.75].map(f => {
          const y = PAD_Y + chartH * f
          return <line key={f} x1={PAD_X} y1={y} x2={W - LABEL_W - PAD_X} y2={y}
            stroke="var(--border-soft)" strokeWidth="0.5" strokeDasharray="2,3" />
        })}

        {/* Candles */}
        {candles.map((c, i) => {
          const x = xFor(i)
          const isUp = c.c >= c.o
          const color = isUp ? 'var(--profit)' : 'var(--loss)'
          const bodyTop = yFor(Math.max(c.o, c.c))
          const bodyBot = yFor(Math.min(c.o, c.c))
          const bodyH = Math.max(1, bodyBot - bodyTop)
          return (
            <g key={`${c.t}-${i}`}>
              {/* Wick */}
              <line x1={x} y1={yFor(c.h)} x2={x} y2={yFor(c.l)}
                stroke={color} strokeWidth="1" />
              {/* Body */}
              <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH}
                fill={color} stroke={color} strokeWidth="0.5" />
            </g>
          )
        })}

        {/* Entry price lines */}
        {entryPrices.map((ep, i) => {
          const y = yFor(ep.price)
          const color = ep.side === 'bid' ? 'var(--profit)' : 'var(--loss)'
          return (
            <g key={`ep-${i}`}>
              <line x1={PAD_X} y1={y} x2={W - LABEL_W - PAD_X} y2={y}
                stroke={color} strokeWidth="1" strokeDasharray="4,3" opacity="0.8" />
              <text x={W - LABEL_W - PAD_X - 2} y={y - 2} fontSize="8" fill={color} textAnchor="end" fontWeight="bold">
                {ep.side === 'bid' ? '▲' : '▼'} {formatPrice(ep.price, symbol)}
              </text>
            </g>
          )
        })}

        {/* Current price line + label */}
        {currentPrice > 0 && (() => {
          const y = yFor(currentPrice)
          return (
            <g>
              <line x1={PAD_X} y1={y} x2={W - LABEL_W - PAD_X} y2={y}
                stroke="var(--teal)" strokeWidth="1" strokeDasharray="2,2" opacity="0.6" />
              <rect x={W - LABEL_W - PAD_X} y={y - 6} width={LABEL_W - 2} height={12}
                fill="var(--teal)" stroke="#000" strokeWidth="0.5" />
              <text x={W - PAD_X - LABEL_W / 2 - 1} y={y + 3}
                fontSize="8" fill="#000" textAnchor="middle" fontWeight="900">
                {formatPrice(currentPrice, symbol)}
              </text>
            </g>
          )
        })()}

        {/* High/low labels at corners */}
        <text x={W - LABEL_W - PAD_X - 2} y={PAD_Y + 7} fontSize="7"
          fill="var(--text-muted)" textAnchor="end">
          H ${formatPrice(maxP, symbol)}
        </text>
        <text x={W - LABEL_W - PAD_X - 2} y={H - PAD_Y - 2} fontSize="7"
          fill="var(--text-muted)" textAnchor="end">
          L ${formatPrice(minP, symbol)}
        </text>
      </svg>
    </div>
  )
})

function IntervalSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const options = ['1m', '5m', '15m', '1h']
  return (
    <div className="flex gap-0.5">
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)}
          className="px-1.5 py-0.5 text-xs font-black"
          style={{
            background: value === o ? 'var(--teal)' : 'var(--surface)',
            color: value === o ? '#000' : 'var(--text-muted)',
            border: '1px solid #000',
            fontSize: '10px',
          }}>
          {o}
        </button>
      ))}
    </div>
  )
}

function formatPrice(p: number, sym: string): string {
  if (sym === 'BONK' || p < 0.001) return p.toFixed(8)
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 1 })
  return p.toFixed(p >= 10 ? 2 : 4)
}
