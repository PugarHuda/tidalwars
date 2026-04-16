export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getCompetition, getTradeEvents, getLastKnownPrices } from '@/lib/store'
import { getChatMessages } from '@/lib/chat'

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
        send('prices', getLastKnownPrices())
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
