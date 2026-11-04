/**
 * Per-episode playback positions, kept in localStorage so a listener can pick
 * up where they stopped — even after closing the tab or the installed PWA.
 *
 * Only meaningful positions are stored: the first few seconds are treated as
 * "not started yet" and the last few as "finished", so the next play begins at
 * the top instead of dropping the listener at the end.
 */

export interface PlaybackProgress {
  /** Seconds into the episode. */
  position: number
  /** Episode length when the position was written (0 if unknown). */
  duration: number
  updatedAt: number
}

const PROGRESS_KEY = 'cosmos-archive:progress'

/** Old episodes fall off once the list grows past this many entries. */
const PROGRESS_LIMIT = 200

/** Positions below this are noise from opening an episode; do not save them. */
const MIN_RESUME_SECONDS = 5

/** Positions this close to the end count as finished. */
const END_MARGIN_SECONDS = 8

function isProgress(value: unknown): value is PlaybackProgress {
  if (!value || typeof value !== 'object') {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.position === 'number' &&
    Number.isFinite(record.position) &&
    record.position >= 0 &&
    typeof record.duration === 'number' &&
    Number.isFinite(record.duration) &&
    record.duration >= 0
  )
}

function readAll(): Record<string, PlaybackProgress> {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY)
    if (!raw) {
      return {}
    }
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    const entries: Record<string, PlaybackProgress> = {}
    for (const [id, value] of Object.entries(parsed)) {
      if (isProgress(value)) {
        entries[id] = {
          position: value.position,
          duration: value.duration,
          updatedAt:
            typeof value.updatedAt === 'number' ? value.updatedAt : Date.now(),
        }
      }
    }
    return entries
  } catch {
    return {}
  }
}

function writeAll(entries: Record<string, PlaybackProgress>): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const kept = Object.entries(entries)
      .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
      .slice(0, PROGRESS_LIMIT)

    const trimmed: Record<string, PlaybackProgress> = {}
    for (const [id, value] of kept) {
      trimmed[id] = value
    }

    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(trimmed))
  } catch {
    // Storage is optional; ignore quota or privacy-mode failures.
  }
}

function isFinished(position: number, duration: number): boolean {
  if (duration <= 0) {
    return false
  }
  return (
    position >= duration - END_MARGIN_SECONDS || position / duration >= 0.99
  )
}

/**
 * Where playback should start for this episode, or null to begin at 0.
 */
export function resumePositionFor(
  id: string,
  knownDuration = 0,
): number | null {
  if (!id) {
    return null
  }

  const entry = readAll()[id]
  if (!entry) {
    return null
  }

  const duration = entry.duration || knownDuration
  if (entry.position < MIN_RESUME_SECONDS) {
    return null
  }
  if (isFinished(entry.position, duration)) {
    return null
  }

  return entry.position
}

/**
 * Remember the current position. Positions near the start are ignored and
 * positions near the end remove the entry, so a finished episode replays from
 * the beginning.
 */
export function savePlaybackProgress(
  id: string,
  position: number,
  duration = 0,
): void {
  if (typeof window === 'undefined' || !id) {
    return
  }
  if (!Number.isFinite(position) || position < 0) {
    return
  }

  const entries = readAll()

  if (isFinished(position, duration)) {
    if (entries[id]) {
      delete entries[id]
      writeAll(entries)
    }
    return
  }

  if (position < MIN_RESUME_SECONDS) {
    return
  }

  entries[id] = {
    position,
    // Keep the last known full length if the element has not reported one.
    duration:
      duration > 0
        ? duration
        : entries[id]?.duration && entries[id].duration > 0
          ? entries[id].duration
          : 0,
    updatedAt: Date.now(),
  }
  writeAll(entries)
}

/** Forget an episode (used when it finishes or playback is restarted). */
export function clearPlaybackProgress(id: string): void {
  if (typeof window === 'undefined' || !id) {
    return
  }

  const entries = readAll()
  if (!entries[id]) {
    return
  }
  delete entries[id]
  writeAll(entries)
}
