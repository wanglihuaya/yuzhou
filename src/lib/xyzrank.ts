import { canonicalLibraryUrl } from './library'

export const XYZRANK_EPISODES_API = 'https://xyzrank.com/api/episodes'

export const XYZRANK_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  accept: 'application/json',
}

export interface XyzrankEpisode {
  title?: unknown
  podcastName?: unknown
  logoURL?: unknown
  link?: unknown
  playCount?: unknown
  duration?: unknown
  primaryGenreName?: unknown
}

export interface EpisodeSummary {
  url: string
  title: string
  podcast: string
  image: string
  playCount: number
  duration: number
  genre: string
}

/**
 * Keep only the fields the UI needs, and normalize every episode link to the
 * canonical xiaoyuzhoufm.com URL used by routing and the library.
 */
export function normalizeXyzrankEpisode(
  raw: XyzrankEpisode,
): EpisodeSummary | null {
  const url = canonicalLibraryUrl(
    typeof raw.link === 'string' ? raw.link : null,
  )
  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  if (!url || !title) {
    return null
  }

  return {
    url,
    title,
    podcast:
      typeof raw.podcastName === 'string' ? raw.podcastName.trim() : '',
    image: typeof raw.logoURL === 'string' ? raw.logoURL : '',
    playCount:
      typeof raw.playCount === 'number' && Number.isFinite(raw.playCount)
        ? raw.playCount
        : 0,
    // The API reports duration in minutes; the rest of the app works in seconds.
    duration:
      typeof raw.duration === 'number' && Number.isFinite(raw.duration)
        ? Math.round(raw.duration * 60)
        : 0,
    genre:
      typeof raw.primaryGenreName === 'string'
        ? raw.primaryGenreName.trim()
        : '',
  }
}
