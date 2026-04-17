import { klpush, klrange } from './kv'

export interface ChatMessage {
  id: string
  userId: string
  displayName: string
  text: string
  timestamp: number
  isSpectator?: boolean   // true if sender isn't a participant in this arena
}

// In-memory fallback (local dev / pre-Redis)
const mem: Map<string, ChatMessage[]> = new Map()

const MAX_MESSAGES = 50
const MAX_TEXT_LEN = 200

function sanitize(text: string): string {
  return text.slice(0, MAX_TEXT_LEN).replace(/[\x00-\x1f\x7f]/g, '').trim()
}

export async function postChatMessage(
  competitionId: string,
  userId: string,
  displayName: string,
  text: string,
  isSpectator = false,
): Promise<ChatMessage | null> {
  const clean = sanitize(text)
  if (!clean) return null
  const msg: ChatMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    displayName: displayName.slice(0, 20),
    text: clean,
    timestamp: Date.now(),
    isSpectator,
  }

  // Write-through: in-memory + Redis list
  if (!mem.has(competitionId)) mem.set(competitionId, [])
  const arr = mem.get(competitionId)!
  arr.unshift(msg)
  if (arr.length > MAX_MESSAGES) arr.pop()

  await klpush(`chat:${competitionId}`, JSON.stringify(msg), MAX_MESSAGES)
  return msg
}

export async function getChatMessages(competitionId: string): Promise<ChatMessage[]> {
  const local = mem.get(competitionId)
  if (local && local.length) return local

  const raw = await klrange(`chat:${competitionId}`, 0, MAX_MESSAGES - 1)
  const parsed: ChatMessage[] = []
  for (const s of raw) {
    try {
      // Upstash may auto-deserialize; handle both string and object
      const msg = typeof s === 'object' ? (s as ChatMessage) : (JSON.parse(s) as ChatMessage)
      parsed.push(msg)
    } catch { /* skip corrupt */ }
  }
  mem.set(competitionId, parsed)
  return parsed
}
