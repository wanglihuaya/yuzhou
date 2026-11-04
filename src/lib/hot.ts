import { createServerFn } from '@tanstack/react-start'

import {
  XYZRANK_EPISODES_API,
  XYZRANK_HEADERS,
  normalizeXyzrankEpisode,
  type EpisodeSummary,
  type XyzrankEpisode,
} from './xyzrank'

const HOT_API = `${XYZRANK_EPISODES_API}?limit=12`
const CACHE_TTL = 30 * 60 * 1000

export type HotEpisode = EpisodeSummary

export interface HotResult {
  ok: boolean
  items: HotEpisode[]
}

let cache: { at: number; items: HotEpisode[] } | null = null

async function loadHotEpisodes(): Promise<HotEpisode[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL) {
    return cache.items
  }

  try {
    const response = await fetch(HOT_API, {
      headers: XYZRANK_HEADERS,
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) {
      throw new Error(`Hot list request failed: ${response.status}`)
    }

    const payload = (await response.json()) as { items?: XyzrankEpisode[] }
    const items = (payload.items ?? [])
      .map(normalizeXyzrankEpisode)
      .filter((item): item is HotEpisode => item !== null)

    if (items.length > 0) {
      cache = { at: Date.now(), items }
      return items
    }
  } catch (error) {
    if (cache) {
      return cache.items
    }
    throw error
  }

  return []
}

/**
 * Public weekly ranking of Xiaoyuzhou episodes, sourced from 中文播客榜.
 * The endpoint needs no login and is cached in memory for 30 minutes.
 */
export const getHotEpisodes = createServerFn({ method: 'GET' }).handler(
  async (): Promise<HotResult> => {
    try {
      return { ok: true, items: await loadHotEpisodes() }
    } catch {
      return { ok: false, items: [] }
    }
  },
)
