export const WECHAT_BLOCKED_EVENT = 'cosmos:wechat-download-blocked'

export interface WeChatBlockedDetail {
  /** Absolute URL of the proxy download that was attempted. */
  href?: string
}

/**
 * WeChat's in-app browser identifies itself as MicroMessenger on iOS,
 * Android, Windows and macOS. Downloads never start there: the webview either
 * shows a blank page or reports "已停止访问该网页".
 */
export function isWeChatBrowser(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }
  return /micromessenger/i.test(navigator.userAgent)
}

export function absoluteHref(href: string): string {
  if (typeof window === 'undefined') {
    return href
  }
  try {
    return new URL(href, window.location.href).toString()
  } catch {
    return href
  }
}

/**
 * Ask the page to explain how to leave WeChat before downloading. The dialog
 * lives in ArchiveApp so this helper stays usable from anywhere.
 */
export function signalWeChatDownloadBlocked(href?: string): void {
  if (typeof window === 'undefined') {
    return
  }
  window.dispatchEvent(
    new CustomEvent<WeChatBlockedDetail>(WECHAT_BLOCKED_EVENT, {
      detail: href ? { href: absoluteHref(href) } : {},
    }),
  )
}
