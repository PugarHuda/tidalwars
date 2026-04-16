import { NextRequest, NextResponse } from 'next/server'
import { getCompetition } from '@/lib/store'
import { postChatMessage, getChatMessages } from '@/lib/chat'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const messages = await getChatMessages(id)
  return NextResponse.json({ messages })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { userId, displayName, text } = body ?? {}
  if (!userId || !displayName || typeof text !== 'string') {
    return NextResponse.json({ error: 'Missing userId, displayName, or text' }, { status: 400 })
  }

  // Must be a participant to chat
  const comp = await getCompetition(id)
  if (!comp) return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
  if (!comp.participants[userId]) {
    return NextResponse.json({ error: 'Only participants can chat' }, { status: 403 })
  }

  const msg = await postChatMessage(id, userId, displayName, text)
  if (!msg) return NextResponse.json({ error: 'Empty message' }, { status: 400 })
  return NextResponse.json({ success: true, message: msg })
}
