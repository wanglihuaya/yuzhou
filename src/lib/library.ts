export type LibraryKind = 'episode' | 'podcast'

export interface LibraryItem {
  url: string
  title: string
  subtitle: string
  kind: LibraryKind
  image: string
  at: number
}

/** Keep the old key so existing visitors keep their recent items. */
const HISTORY_KEY = 'cosmos-archive:recent'
const FAVORITES_KEY = 'cosmos-archive:favorites'

export const HISTORY_LIMIT = 30
export const FAVORITES_LIMIT = 60

function isLibraryItem(value: unknown): value is LibraryItem {
  if (!value || typeof value !== 'object') {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.url === 'string' &&
    record.url.length > 0 &&
    typeof record.title === 'string' &&
    (record.kind === 'episode' || record.kind === 'podcast')
  )
}

function normalize(item: LibraryItem): LibraryItem {
  return {
    url: item.url,
    title: item.title,
    subtitle: typeof item.subtitle === 'string' ? item.subtitle : '',
    kind: item.kind,
    image: typeof item.image === 'string' ? item.image : '',
    at: typeof item.at === 'number' ? item.at : Date.now(),
  }
}

function read(key: string, limit: number): LibraryItem[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    const seen = new Set<string>()
    return parsed
      .filter(isLibraryItem)
      .map(normalize)
      .filter((item) => {
        if (seen.has(item.url)) {
          return false
        }
        seen.add(item.url)
        return true
      })
      .slice(0, limit)
  } catch {
    return []
  }
}

function write(key: string, items: LibraryItem[], limit: number): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(items.slice(0, limit)))
  } catch {
    // Storage is optional; ignore quota or privacy-mode failures.
  }
}

export function loadHistory(): LibraryItem[] {
  return read(HISTORY_KEY, HISTORY_LIMIT)
}

export function saveHistory(items: LibraryItem[]): void {
  write(HISTORY_KEY, items, HISTORY_LIMIT)
}

export function loadFavorites(): LibraryItem[] {
  return read(FAVORITES_KEY, FAVORITES_LIMIT)
}

export function saveFavorites(items: LibraryItem[]): void {
  write(FAVORITES_KEY, items, FAVORITES_LIMIT)
}

/**
 * Normalize any accepted episode/podcast URL (including the .dev alias) to the
 * canonical xiaoyuzhoufm.com address used for dedupe and active-state matching.
 */
export function canonicalLibraryUrl(input?: string | null): string | null {
  if (!input) {
    return null
  }

  const match = /(episode|podcast)\/([0-9a-zA-Z]{24})/i.exec(input)
  if (!match) {
    return null
  }

  return `https://www.xiaoyuzhoufm.com/${match[1].toLowerCase()}/${match[2]}`
}
