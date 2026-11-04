import { createServerFn } from '@tanstack/react-start'

import {
  XYZRANK_EPISODES_API,
  XYZRANK_HEADERS,
  normalizeXyzrankEpisode,
  type EpisodeSummary,
  type XyzrankEpisode,
} from './xyzrank'

const SEARCH_LIMIT = 50
const REQUEST_TIMEOUT = 8000
const CACHE_TTL = 5 * 60 * 1000
const CACHE_LIMIT = 30

export type SearchEpisode = EpisodeSummary

export interface SearchResult {
  ok: boolean
  items: SearchEpisode[]
  total: number
}

interface CachedResult {
  at: number
  result: SearchResult
}

const cache = new Map<string, CachedResult>()

function readCache(key: string): SearchResult | null {
  const hit = cache.get(key)
  if (!hit) {
    return null
  }

  if (Date.now() - hit.at >= CACHE_TTL) {
    cache.delete(key)
    return null
  }

  // Refresh insertion order so the least recently used entry is evicted first.
  cache.delete(key)
  cache.set(key, hit)
  return hit.result
}

function writeCache(key: string, result: SearchResult): void {
  cache.set(key, { at: Date.now(), result })
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) {
      cache.delete(oldest)
    }
  }
}

async function searchXyzrank(query: string): Promise<SearchResult> {
  const key = query.toLocaleLowerCase('zh-CN')
  const cached = readCache(key)
  if (cached) {
    return cached
  }

  const endpoint = new URL(XYZRANK_EPISODES_API)
  endpoint.searchParams.set('offset', '0')
  endpoint.searchParams.set('limit', String(SEARCH_LIMIT))
  endpoint.searchParams.set('q', query)

  try {
    const response = await fetch(endpoint, {
      headers: XYZRANK_HEADERS,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    })
    if (!response.ok) {
      throw new Error(`Search request failed: ${response.status}`)
    }

    const payload = (await response.json()) as {
      items?: XyzrankEpisode[]
      total?: unknown
    }
    const items = (payload.items ?? [])
      .map(normalizeXyzrankEpisode)
      .filter((item): item is SearchEpisode => item !== null)
    const reportedTotal =
      typeof payload.total === 'number' && Number.isFinite(payload.total)
        ? Math.max(0, Math.floor(payload.total))
        : items.length

    const result: SearchResult = {
      ok: true,
      items,
      total: Math.max(reportedTotal, items.length),
    }
    writeCache(key, result)
    return result
  } catch {
    return { ok: false, items: [], total: 0 }
  }
}

/**
 * Keyword search across Xiaoyuzhou episodes, backed by the public
 * 中文播客榜 API. Short-lived memory caching keeps repeated queries cheap.
 */
export const searchEpisodes = createServerFn({ method: 'GET' })
  .validator((input: unknown) => {
    if (typeof input !== 'string' || !input.trim()) {
      throw new Error('请输入搜索关键词')
    }
    return Array.from(input.trim()).slice(0, 80).join('')
  })
  .handler(async ({ data }): Promise<SearchResult> => {
    return searchXyzrank(data)
  })
