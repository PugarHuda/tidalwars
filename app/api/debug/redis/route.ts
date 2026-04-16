import { NextResponse } from 'next/server'
import { kget, kset, kzadd, kzrevrange, isKvEnabled } from '@/lib/kv'

/** Dev-only endpoint: proves Redis roundtrip works end-to-end */
export async function GET() {
  const key = `debug:${Date.now()}`
  const obj = { hello: 'world', at: Date.now() }

  await kset(key, obj, 60) // 1 minute TTL
  const readBack = await kget<unknown>(key)

  await kzadd('debug:zset', 42, 'member-a', 60)
  const topSet = await kzrevrange('debug:zset', 0, 5)

  return NextResponse.json({
    kvEnabled: isKvEnabled(),
    url: process.env.UPSTASH_REDIS_REST_URL?.slice(0, 30) + '...',
    writeKey: key,
    wrote: obj,
    readBack,
    readBackType: typeof readBack,
    zsetTop: topSet,
  })
}
