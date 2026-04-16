/**
 * Thin wrapper around Upstash Redis for serverless-safe persistence.
 * Falls back to no-op when UPSTASH_REDIS_REST_URL is not set (local dev uses in-memory).
 */
import { Redis } from '@upstash/redis'

let _r: Redis | null = null

function r(): Redis | null {
  if (_r) return _r
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  _r = new Redis({ url, token })
  return _r
}

export async function kget<T>(key: string): Promise<T | null> {
  try {
    const client = r()
    if (!client) return null
    return await client.get<T>(key)
  } catch { return null }
}

export async function kset(key: string, value: unknown, ex = 86400): Promise<void> {
  try {
    const client = r()
    if (!client) return
    await client.set(key, value, { ex })
  } catch { /* silent — never block trade execution */ }
}

export async function ksadd(key: string, ...members: string[]): Promise<void> {
  try {
    const client = r()
    if (!client) return
    await client.sadd(key, members[0], ...members.slice(1))
    await client.expire(key, 86400 * 7)
  } catch { /* silent */ }
}

export async function ksmembers(key: string): Promise<string[]> {
  try {
    const client = r()
    if (!client) return []
    const members = await client.smembers(key)
    return (members ?? []) as string[]
  } catch { return [] }
}

export async function klpush(key: string, value: string, cap = 100, ttl = 86400): Promise<void> {
  try {
    const client = r()
    if (!client) return
    await client.lpush(key, value)
    await client.ltrim(key, 0, cap - 1)
    await client.expire(key, ttl)
  } catch { /* silent */ }
}

export async function klrange(key: string, start = 0, stop = -1): Promise<string[]> {
  try {
    const client = r()
    if (!client) return []
    return ((await client.lrange(key, start, stop)) ?? []) as string[]
  } catch { return [] }
}

export function isKvEnabled(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL)
}
