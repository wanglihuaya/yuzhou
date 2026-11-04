/* 宇宙备份 · CDN 流式下载 Service Worker
 *
 * 页面把 <a href="/__cosmos_stream?url=…&filename=…"> 交给浏览器，
 * 本 worker 拦截该请求，把 CDN 的响应流原样返回，并加上
 * Content-Disposition: attachment。这样浏览器原生下载管理器接管下载：
 * 有进度、可后台、可断点续传，且文件不经过应用服务器。
 */

const STREAM_PATH = '/__cosmos_stream'

const ALLOWED_HOST_PATTERNS = [
  /(^|\.)xyzcdn\.net$/i,
  /(^|\.)xiaoyuzhoufm\.com$/i,
]

const UPSTREAM_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  referer: 'https://www.xiaoyuzhoufm.com/',
  accept: '*/*',
}

function isAllowed(raw) {
  try {
    const url = new URL(raw)
    return (
      url.protocol === 'https:' &&
      ALLOWED_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))
    )
  } catch {
    return false
  }
}

function cleanFilename(raw) {
  const cleaned = String(raw || 'download')
    .replace(/[\u0000-\u001f\u007f\r\n]/g, '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return (cleaned || 'download').slice(0, 180)
}

function contentDisposition(filename) {
  const fallback = filename
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_')
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  )

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

async function handleStream(request) {
  const url = new URL(request.url)
  const target = url.searchParams.get('url')

  if (!target || !isAllowed(target)) {
    return new Response('该地址不在允许下载的范围内', { status: 403 })
  }

  const filename = cleanFilename(url.searchParams.get('filename'))
  const headers = { ...UPSTREAM_HEADERS }
  const range = request.headers.get('range')
  if (range) {
    headers.range = range
  }

  let upstream
  try {
    upstream = await fetch(target, { headers, redirect: 'follow' })
  } catch {
    return new Response('上游请求失败', { status: 502 })
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(`下载失败（HTTP ${upstream.status}）`, {
      status: upstream.status === 404 ? 404 : 502,
    })
  }

  const out = new Headers()
  for (const name of [
    'content-type',
    'content-range',
    'accept-ranges',
  ]) {
    const value = upstream.headers.get(name)
    if (value) {
      out.set(name, value)
    }
  }

  // content-length 只在没有压缩时透传，否则浏览器进度会失真。
  const contentLength = upstream.headers.get('content-length')
  if (contentLength && !upstream.headers.get('content-encoding')) {
    out.set('content-length', contentLength)
  }

  out.set('content-disposition', contentDisposition(filename))
  out.set('cache-control', 'no-store')
  out.set('x-content-type-options', 'nosniff')

  return new Response(upstream.body, {
    status: upstream.status,
    headers: out,
  })
}

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return
  }

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin || url.pathname !== STREAM_PATH) {
    return
  }

  event.respondWith(handleStream(event.request))
})
