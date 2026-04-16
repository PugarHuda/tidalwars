import { NextResponse } from 'next/server'
import { getInstruments } from '@/lib/pacifica'

/**
 * Returns all Pacifica instruments with their real funding rates.
 * This is the ground-truth funding rate data from the Pacifica testnet /info endpoint.
 * Prices are NOT available via REST — they're only available via WebSocket.
 */
export async function GET() {
  const instruments = await getInstruments()
  return NextResponse.json({
    instruments,
    note: 'Prices available via WebSocket only (wss://test-ws.pacifica.fi/ws)',
    source: 'https://test-api.pacifica.fi/api/v1/info',
  })
}
