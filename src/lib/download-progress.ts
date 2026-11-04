export interface DownloadProgressState {
  /** File name being downloaded. */
  label: string
  /** Bytes received so far (from the CDN). */
  received: number
  /** Total size when the CDN reports Content-Length. */
  total: number | null
  /** True once the bytes are fully written to disk. */
  done: boolean
}

let state: DownloadProgressState | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

/** Update the shared transfer state (null clears the panel). */
export function setDownloadProgress(next: DownloadProgressState | null): void {
  state = next
  emit()
}

export function getDownloadProgress(): DownloadProgressState | null {
  return state
}

export function subscribeDownloadProgress(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

let clearTimer: ReturnType<typeof setTimeout> | null = null

/** Show a short-lived "done" state, then hide the panel. */
export function finishDownloadProgress(label: string): void {
  if (!state || state.label !== label) {
    return
  }
  setDownloadProgress({ ...state, done: true })
  if (clearTimer) {
    clearTimeout(clearTimer)
  }
  clearTimer = setTimeout(() => {
    if (state?.label === label) {
      setDownloadProgress(null)
    }
  }, 1_800)
}

export function clearDownloadProgress(label: string): void {
  if (state?.label === label) {
    setDownloadProgress(null)
  }
}
