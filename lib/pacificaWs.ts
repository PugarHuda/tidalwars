'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export const PACIFICA_WS = process.env.NEXT_PUBLIC_PACIFICA_WS_URL ?? 'wss://test-ws.pacifica.fi/ws'

export interface MarketTicker {
  symbol: string
  markPrice: number
  lastPrice: number
  fundingRate: number   // e.g. 0.0001 = 0.01% per 8h
  change24h: number     // percent
  openInterest: number  // USD notional
  volume24h: number     // USD
  indexPrice: number
}

// Symbols in Pacifica WS format (try both with and without -PERP suffix)
const WS_SYMBOLS = [
  'BTC-PERP', 'ETH-PERP', 'SOL-PERP', 'WIF-PERP', 'BONK-PERP',
  'BTC', 'ETH', 'SOL', 'WIF', 'BONK',
]

type Raw = Record<string, string | number | null | undefined>

function parse(raw: Raw): Partial<MarketTicker> {
  const f = (k: string[]) => k.reduce<number>((v, key) => v || +String(raw[key] ?? 0) || 0, 0)
  return {
    markPrice:    f(['mark_price', 'markPrice', 'price', 'markPx']),
    lastPrice:    f(['last_price', 'lastPrice', 'lastPx']),
    fundingRate:  f(['funding_rate', 'fundingRate', 'fr', 'fundingRateHourly']),
    change24h:    f(['change_24h', 'priceChangePercent', 'price_change_24h', 'change24h']),
    openInterest: f(['open_interest', 'openInterest', 'oi']),
    volume24h:    f(['volume_24h', 'volume', 'quoteVolume', 'vol24h']),
    indexPrice:   f(['index_price', 'indexPrice', 'indexPx']),
  }
}

function blank(symbol: string): MarketTicker {
  return { symbol, markPrice: 0, lastPrice: 0, fundingRate: 0, change24h: 0, openInterest: 0, volume24h: 0, indexPrice: 0 }
}

/**
 * Hook that connects to the Pacifica WebSocket and streams live market data.
 * Handles multiple message formats (we try all known schemas).
 * Auto-reconnects on disconnect. Falls back gracefully if WS is unavailable.
 */
export function usePacificaWs() {
  const [tickers, setTickers] = useState<Record<string, MarketTicker>>({})
  const [wsConnected, setWsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const upsert = useCallback((symbol: string, partial: Partial<MarketTicker>) => {
    setTickers(prev => ({
      ...prev,
      [symbol]: { ...(prev[symbol] ?? blank(symbol)), ...partial },
    }))
  }, [])

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    try {
      const ws = new WebSocket(PACIFICA_WS)
      wsRef.current = ws

      ws.onopen = () => {
        setWsConnected(true)
        clearTimeout(reconnectRef.current)
        // Try multiple subscription formats — we'll parse whatever arrives
        try { ws.send(JSON.stringify({ op: 'subscribe', args: WS_SYMBOLS.map(s => `ticker:${s}`) })) } catch {}
        try { ws.send(JSON.stringify({ op: 'subscribe', channel: 'tickers' })) } catch {}
        try { ws.send(JSON.stringify({ method: 'SUBSCRIBE', params: WS_SYMBOLS.map(s => s.toLowerCase() + '@ticker') })) } catch {}
        try { ws.send(JSON.stringify({ type: 'subscribe', streams: WS_SYMBOLS.map(s => `${s}/ticker`) })) } catch {}
      }

      ws.onmessage = ({ data }) => {
        try {
          const msg = JSON.parse(data as string) as Record<string, unknown>

          // Format A: {topic: "ticker:BTC-PERP", data: {...}}
          if (typeof msg.topic === 'string' && msg.topic.startsWith('ticker:') && msg.data) {
            upsert(msg.topic.slice(7), parse(msg.data as Raw))
          }

          // Format B: {channel: "tickers", data: [{symbol, ...}]}
          if (msg.channel === 'tickers' && Array.isArray(msg.data)) {
            msg.data.forEach((m: Raw) => { if (m.symbol) upsert(String(m.symbol), parse(m)) })
          }

          // Format C: {type: "ticker", symbol: "BTC-PERP", ...}
          if (msg.type === 'ticker' && msg.symbol) {
            upsert(String(msg.symbol), parse(msg as Raw))
          }

          // Format D: Binance-style {e: "24hrTicker", s: "BTC-PERP", ...}
          if (msg.e === '24hrTicker' && msg.s) {
            const raw: Raw = {
              mark_price: msg.c as string,
              last_price: msg.c as string,
              change_24h: msg.P as string,
              volume_24h: msg.q as string,
            }
            upsert(String(msg.s), parse(raw))
          }

          // Format E: direct object {symbol, mark_price, ...}
          if (!msg.type && !msg.channel && !msg.topic && msg.symbol && (msg.mark_price || msg.markPrice)) {
            upsert(String(msg.symbol), parse(msg as Raw))
          }

          // Format F: top-level array [{symbol, mark_price, ...}]
          if (Array.isArray(msg)) {
            msg.forEach((m: Raw) => { if (m.symbol) upsert(String(m.symbol), parse(m)) })
          }

          // Format G: {markets: [...]}
          if (Array.isArray((msg as { markets?: unknown[] }).markets)) {
            const markets = (msg as { markets: Raw[] }).markets
            markets.forEach((m) => { if (m.symbol) upsert(String(m.symbol), parse(m)) })
          }
        } catch { /* ignore parse errors */ }
      }

      ws.onclose = () => {
        setWsConnected(false)
        reconnectRef.current = setTimeout(connect, 4000)
      }
      ws.onerror = () => ws.close()
    } catch { /* ignore connection errors */ }
  }, [upsert])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { tickers, wsConnected }
}
