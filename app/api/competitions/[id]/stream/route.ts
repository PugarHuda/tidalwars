export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getCompetition, getTradeEvents, getLastKnownPrices, updateLastKnownPrices } from '@/lib/store'
import { getChatMessages } from '@/lib/chat'

const PACIFICA_REST = process.env.NEXT_PUBLIC_PACIFICA_REST_URL ?? 'https://test-api.pacifica.fi/api/v1'

async function fetchLivePrices(): Promise<Record<string, number>> {
  try {
    const res = await fetch(`${PACIFICA_REST}/info/prices`, { next: { revalidate: 3 } })
    if (!res.ok) return {}
    const json = await res.json()
    const rows = Array.isArray(json?.data) ? json.data : []
    const prices: Record<string, number> = {}
    for (const row of rows as { symbol: string; mark?: string; mid?: string }[]) {
      const p = parseFloat(row.mark ?? row.mid ?? '0')
      if (p > 0 && row.symbol) {
        prices[row.symbol] = p
        if (row.symbol.startsWith('k') && row.symbol.length > 1) prices[row.symbol.slice(1)] = p / 1000
      }
    }
    return prices
  } catch { return {} }
}

/**
 * Server-Sent Events endpoint for real-time competition updates.
 * Pushes competition state, trade feed, and cached prices every 2 seconds.
 * Client can use EventSource API to subscribe instead of polling.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream({
    start(controller) {
      const send = (type: string, data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type, data, ts: Date.now() })}\n\n`)
          )
        } catch { /* client disconnected */ }
      }

      const push = async () => {
        if (closed) return
        const comp = await getCompetition(id)
        if (!comp) {
          send('error', { message: 'Competition not found' })
          return
        }
        send('competition', comp)
        send('feed', (await getTradeEvents(id)).slice(0, 30))
        send('chat', await getChatMessages(id))

        // If last-known prices are empty/stale, fetch fresh from Pacifica
        let prices = getLastKnownPrices()
        if (Object.keys(prices).length === 0) {
          const fresh = await fetchLivePrices()
          if (Object.keys(fresh).length > 0) {
            updateLastKnownPrices(fresh)
            prices = fresh
          }
        }
        send('prices', prices)
      }

      // Send immediately on connection
      push()

      const interval = setInterval(async () => {
        if (closed) { clearInterval(interval); return }
        push()
      }, 2000)

      req.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(interval)
        try { controller.close() } catch { /* ignore */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering for Vercel
    },
  })
}
