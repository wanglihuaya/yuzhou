import { toast } from 'sonner'

import {
  clearDownloadProgress,
  finishDownloadProgress,
  setDownloadProgress,
} from './download-progress'

export function triggerDownload(href: string): void {
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

/**
 * Files above this limit are not buffered into a Blob; they fall back to a
 * direct navigation instead. Mobile devices get a much lower ceiling so a long
 * episode cannot exhaust the tab's memory.
 */
function maxBlobBytes(): number {
  if (typeof navigator === 'undefined') {
    return 120 * 1024 * 1024
  }

  const isMobile = /Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(
    navigator.userAgent,
  )
  if (!isMobile) {
    return 120 * 1024 * 1024
  }

  const memory = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory
  if (typeof memory === 'number' && memory > 0 && memory <= 4) {
    return 24 * 1024 * 1024
  }
  return 48 * 1024 * 1024
}

const STREAM_PATH = '/__cosmos_stream'

function streamHref(url: string, filename: string): string {
  return `${STREAM_PATH}?url=${encodeURIComponent(
    url,
  )}&filename=${encodeURIComponent(filename)}`
}

const UPDATE_CHECK_INTERVAL = 15 * 60_000

/** Register the streaming service worker once the page is interactive. */
export function registerServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  void navigator.serviceWorker
    .register('/sw.js', { scope: '/', updateViaCache: 'none' })
    .then((registration) => {
      // A new worker can already be waiting when this page is a returning tab.
      if (navigator.serviceWorker.controller && registration.waiting) {
        promptServiceWorkerUpdate(registration)
      }

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing
        if (!installing) {
          return
        }

        installing.addEventListener('statechange', () => {
          if (
            installing.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            promptServiceWorkerUpdate(registration)
          }
        })
      })

      // Check for a new deploy when the tab comes back to the foreground,
      // at most once every 15 minutes.
      let lastCheck = Date.now()
      const check = () => {
        if (document.visibilityState !== 'visible') {
          return
        }
        if (Date.now() - lastCheck < UPDATE_CHECK_INTERVAL) {
          return
        }
        lastCheck = Date.now()
        void registration.update().catch(() => {})
      }

      document.addEventListener('visibilitychange', check)
      window.addEventListener('focus', check)
    })
    .catch(() => {
      // Streaming downloads are an enhancement; ignore registration failures.
    })
}

let updatePrompted = false

/**
 * The new worker waits until the user agrees, so the current page keeps its
 * build's chunks (and any playing audio) intact a little longer. Once they
 * refresh, the new worker activates and clears every old cache.
 */
function promptServiceWorkerUpdate(
  registration: ServiceWorkerRegistration,
): void {
  if (updatePrompted) {
    return
  }
  updatePrompted = true

  toast('新版本已就绪', {
    id: 'service-worker-update',
    description: '刷新页面即可使用最新版本。',
    duration: Infinity,
    action: {
      label: '刷新',
      onClick: () => {
        const waiting = registration.waiting
        if (!waiting) {
          window.location.reload()
          return
        }

        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => window.location.reload(),
          { once: true },
        )
        waiting.postMessage({ type: 'SKIP_WAITING' })
      },
    },
  })
}

/**
 * Resolve true only when a service worker is actually controlling this page,
 * so a download link cannot hit the network un-intercepted.
 */
async function ensureServiceWorker(timeoutMs = 2_500): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return false
  }
  if (navigator.serviceWorker.controller) {
    return true
  }

  try {
    await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    })
  } catch {
    return false
  }

  if (navigator.serviceWorker.controller) {
    return true
  }

  return await new Promise<boolean>((resolve) => {
    const finish = (value: boolean) => {
      window.clearTimeout(timer)
      navigator.serviceWorker.removeEventListener('controllerchange', onChange)
      resolve(value)
    }
    const onChange = () => {
      if (navigator.serviceWorker.controller) {
        finish(true)
      }
    }
    const timer = window.setTimeout(() => {
      finish(Boolean(navigator.serviceWorker.controller))
    }, timeoutMs)

    navigator.serviceWorker.addEventListener('controllerchange', onChange)
    void navigator.serviceWorker.ready
      .then(() => {
        if (navigator.serviceWorker.controller) {
          finish(true)
        }
      })
      .catch(() => {
        finish(false)
      })
  })
}

interface SaveFileHandle {
  createWritable: () => Promise<WritableStream<Uint8Array>>
}

interface SaveFilePickerWindow {
  showSaveFilePicker?: (options: {
    suggestedName?: string
  }) => Promise<SaveFileHandle>
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

async function remoteSize(url: string): Promise<number | null> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    if (!response.ok) {
      return null
    }
    const length = Number(response.headers.get('content-length'))
    return Number.isFinite(length) && length > 0 ? length : null
  } catch {
    return null
  }
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Save a media file straight from the CDN, without proxying it through the
 * server. Chromium gets a real file-system stream; other browsers buffer the
 * response into a Blob and save that. `fallbackHref` (the /api/download proxy)
 * is only used when the CDN cannot be read from the page.
 */
export async function downloadFromCdn(
  url: string,
  filename: string,
  fallbackHref?: string,
  options?: { useFilePicker?: boolean },
): Promise<void> {
  if (typeof window === 'undefined') {
    return
  }

  // 0) Preferred: let the browser's own download manager stream the CDN
  // response through the service worker. Works on mobile, keeps memory flat,
  // shows native progress and supports resuming.
  if (await ensureServiceWorker()) {
    triggerDownload(streamHref(url, filename))
    return
  }

  const picker = options?.useFilePicker === false
    ? undefined
    : (window as SaveFilePickerWindow).showSaveFilePicker

  setDownloadProgress({ label: filename, received: 0, total: null, done: false })

  const blobLimit = maxBlobBytes()

  // 1) Stream directly to disk (Chrome / Edge desktop).
  if (picker) {
    try {
      const handle = await picker.call(window, { suggestedName: filename })
      const response = await fetch(url)
      if (!response.ok || !response.body) {
        throw new Error(`下载失败（HTTP ${response.status}）`)
      }
      const total = Number(response.headers.get('content-length')) || null
      let received = 0
      let lastReport = 0
      const counted = response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            received += chunk.byteLength
            const now = Date.now()
            if (now - lastReport > 120) {
              lastReport = now
              setDownloadProgress({
                label: filename,
                received,
                total,
                done: false,
              })
            }
            controller.enqueue(chunk)
          },
        }),
      )
      await counted.pipeTo(await handle.createWritable())
      finishDownloadProgress(filename)
      return
    } catch (error) {
      if (isAbort(error)) {
        clearDownloadProgress(filename)
        return
      }
      // Fall through to the Blob path.
    }
  }

  // 2) Buffer into a Blob (all other browsers). Skip oversized files so a
  // large episode cannot exhaust memory on a phone.
  try {
    const size = await remoteSize(url)
    if (size !== null && size > blobLimit) {
      // Too large to buffer: open the CDN URL directly (no server involved).
      triggerDownload(url)
      finishDownloadProgress(filename)
      return
    }
    const response = await fetch(url)
    if (!response.ok || !response.body) {
      throw new Error(`下载失败（HTTP ${response.status}）`)
    }
    const total = Number(response.headers.get('content-length')) || size
    const reader = response.body.getReader()
    const chunks: BlobPart[] = []
    let received = 0
    let lastReport = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      chunks.push(value as BlobPart)
      received += value.byteLength
      const now = Date.now()
      if (now - lastReport > 120) {
        lastReport = now
        setDownloadProgress({ label: filename, received, total, done: false })
      }
    }
    saveBlob(new Blob(chunks, { type: 'application/octet-stream' }), filename)
    finishDownloadProgress(filename)
    return
  } catch {
    // 3) Last resort when the CDN cannot be read from this page.
    clearDownloadProgress(filename)
    triggerDownload(fallbackHref ?? url)
  }
}

export function downloadText(filename: string, content: string): void {
  const blob = new Blob(['﻿', content], {
    type: 'text/plain;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      const copied = await Promise.race([
        navigator.clipboard.writeText(text).then(() => true),
        new Promise<boolean>((resolve) => {
          window.setTimeout(() => resolve(false), 1_200)
        }),
      ])
      if (copied) {
        return true
      }
    }
  } catch {
    // Fall through to the legacy copy path.
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  return copied
}
