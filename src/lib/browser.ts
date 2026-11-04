export type RecentKind = 'episode' | 'podcast'

export interface RecentItem {
  url: string
  title: string
  subtitle: string
  kind: RecentKind
  image: string
  at: number
}

const RECENT_KEY = 'cosmos-archive:recent'

export function triggerDownload(href: string): void {
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
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

export function loadRecent(): RecentItem[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    if (!raw) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
      .filter((item): item is RecentItem => {
        if (!item || typeof item !== 'object') {
          return false
        }
        const record = item as Record<string, unknown>
        return (
          typeof record.url === 'string' &&
          typeof record.title === 'string' &&
          (record.kind === 'episode' || record.kind === 'podcast')
        )
      })
      .slice(0, 6)
  } catch {
    return []
  }
}

export function saveRecent(items: RecentItem[]): void {
  try {
    window.localStorage.setItem(
      RECENT_KEY,
      JSON.stringify(items.slice(0, 6)),
    )
  } catch {
    // Storage is optional; ignore quota or privacy-mode failures.
  }
}

export function addRecent(item: RecentItem): RecentItem[] {
  const next = [
    item,
    ...loadRecent().filter((existing) => existing.url !== item.url),
  ].slice(0, 6)
  saveRecent(next)
  return next
}
