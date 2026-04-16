/**
 * Elfa AI Integration — Smart social intelligence for crypto markets
 * Docs: https://docs.elfa.ai
 * API: https://api.elfa.ai/v2
 * Auth: x-elfa-api-key header
 *
 * Features used:
 * - Trending tokens (by social mentions + smart engagement)
 * - Used in arena to show AI market pulse alongside live trades
 */

const ELFA_BASE = 'https://api.elfa.ai/v2'

export interface TrendingToken {
  token: string
  symbol: string
  mentionCount: number
  smartMentionCount?: number
  changePercent?: number
  rank: number
}

export interface ElfaMention {
  text: string
  smartEngagement: number
  sentimentScore?: number
  postedAt: string
}

function headers() {
  return { 'x-elfa-api-key': process.env.ELFA_API_KEY ?? '' }
}

/** Normalize across all known v1/v2 field name variants */
function normalizeTrendingToken(item: Record<string, unknown>, i: number): TrendingToken {
  const symbol = String(
    item.symbol ?? item.token ?? item.name ?? item.ticker ?? ''
  ).replace(/[^A-Z0-9]/gi, '').toUpperCase()
  return {
    token: String(item.token ?? item.name ?? symbol),
    symbol,
    mentionCount: Number(
      item.mentions_count ?? item.mention_count ?? item.mentions ?? item.count ?? 0
    ),
    smartMentionCount: item.smart_mentions_count != null
      ? Number(item.smart_mentions_count)
      : item.smart_mention_count != null ? Number(item.smart_mention_count) : undefined,
    changePercent: item.change_percent != null
      ? Number(item.change_percent)
      : item.change_24h != null ? Number(item.change_24h) : undefined,
    rank: i + 1,
  }
}

/**
 * Fetch trending tokens from Elfa AI v2 /aggregations/trending-tokens.
 * Returns [] if ELFA_API_KEY missing or request fails.
 */
export async function getTrendingTokens(
  timeWindow: '1h' | '4h' | '24h' | '7d' = '4h',
  limit = 10
): Promise<TrendingToken[]> {
  if (!process.env.ELFA_API_KEY) return []
  try {
    const params = new URLSearchParams({
      timeWindow,
      page: '1',
      pageSize: String(limit),
      minMentions: '5',
    })
    const res = await fetch(`${ELFA_BASE}/aggregations/trending-tokens?${params}`, {
      headers: headers(),
      next: { revalidate: 300 },
    })
    if (!res.ok) {
      console.warn('[Elfa] trending-tokens failed:', res.status)
      return []
    }
    const json = await res.json()
    const raw: Record<string, unknown>[] =
      json?.data ?? json?.tokens ?? (Array.isArray(json) ? json : [])
    return raw
      .map(normalizeTrendingToken)
      .filter(t => t.symbol.length > 0)
      .slice(0, limit)
  } catch {
    return []
  }
}

/**
 * Fetch smart mentions (high-signal social content) for given symbols.
 * Returns [] if not enabled or on any error.
 */
export async function getSmartMentions(
  symbols: string[],
  limit = 5
): Promise<ElfaMention[]> {
  if (!process.env.ELFA_API_KEY) return []
  try {
    const params = new URLSearchParams({ keywords: symbols.join(','), limit: String(limit) })
    const res = await fetch(`${ELFA_BASE}/mentions/search?${params}`, {
      headers: headers(),
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    const json = await res.json()
    const raw: Record<string, unknown>[] = json?.data ?? (Array.isArray(json) ? json : [])
    return raw.map(item => ({
      text: String(item.content ?? item.text ?? item.body ?? ''),
      smartEngagement: Number(item.smart_engagement ?? item.engagement_score ?? 0),
      sentimentScore: item.sentiment_score != null ? Number(item.sentiment_score) : undefined,
      postedAt: String(item.created_at ?? item.posted_at ?? new Date().toISOString()),
    })).filter(m => m.text)
  } catch {
    return []
  }
}

export function isElfaEnabled(): boolean {
  return Boolean(process.env.ELFA_API_KEY)
}
