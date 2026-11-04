/* 宇宙备份 · Service Worker
 *
 * 两个职责：
 *
 * 1. CDN 流式下载。页面把 <a href="/__cosmos_stream?url=…&filename=…"> 交给浏览器，
 *    本 worker 拦截该请求，把 CDN 的响应流原样返回，并加上
 *    Content-Disposition: attachment。浏览器原生下载管理器接管下载：
 *    有进度、可后台、可断点续传，文件不经过应用服务器。
 *
 * 2. PWA 缓存。每次构建都会把 BUILD_ID 写进本文件；缓存名带 BUILD_ID，
 *    新版本激活时会把旧缓存全部删掉。页面导航始终网络优先，发版后不会
 *    继续返回旧 HTML；只有带哈希的 /assets/ 才会 cache-first。
 *
 * 更新策略：安装后不自动 skipWaiting，页面会提示「新版本已就绪」，
 * 用户确认后发送 SKIP_WAITING，新 worker 接管并清理旧缓存。
 */

const STREAM_PATH = '/__cosmos_stream'

// 构建时由 vite 插件替换；开发环境保持占位符，此时不启用缓存。
const BUILD_ID = '__SW_BUILD_ID__'
const IS_DEV = BUILD_ID.startsWith('__')

const CACHE_PREFIX = 'yuzhou-'
const STATIC_CACHE = `${CACHE_PREFIX}static-${BUILD_ID}`
const PAGE_CACHE = `${CACHE_PREFIX}pages-${BUILD_ID}`

const PRECACHE_URLS = [
  '/favicon.svg',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
]

const SKIP_PATH_PREFIXES = ['/api/', '/_serverFn/', '/__']

const CACHEABLE_DESTINATIONS = new Set([
  'script',
  'style',
  'font',
  'image',
  'manifest',
])

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

/* ---- 安装 / 激活 -------------------------------------------------------- */

self.addEventListener('install', (event) => {
  if (IS_DEV) {
    return
  }

  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE)
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: 'reload' }))
          } catch {
            // An icon or the manifest may be unavailable in a stripped build.
          }
        }),
      )
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if (!IS_DEV) {
        const names = await caches.keys()
        await Promise.all(
          names
            .filter(
              (name) =>
                name.startsWith(CACHE_PREFIX) &&
                name !== STATIC_CACHE &&
                name !== PAGE_CACHE,
            )
            .map((name) => caches.delete(name)),
        )
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

/* ---- 缓存策略 ------------------------------------------------------------ */

async function networkFirstPage(request) {
  try {
    // 页面（SSR HTML）永远先问网络，避免发版后继续返回旧页面。
    const response = await fetch(request, { cache: 'no-cache' })
    if (response.ok) {
      const cache = await caches.open(PAGE_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cache = await caches.open(PAGE_CACHE)
    const cached =
      (await cache.match(request)) || (await cache.match('/'))
    if (cached) {
      return cached
    }
    return Response.error()
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)
  if (cached) {
    return cached
  }

  const response = await fetch(request)
  if (response.ok) {
    cache.put(request, response.clone())
  }
  return response
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)
  const revalidate = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => undefined)

  if (cached) {
    return cached
  }

  const response = await revalidate
  return response || Response.error()
}

/* ---- fetch -------------------------------------------------------------- */

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) {
    return
  }

  if (url.pathname === STREAM_PATH) {
    event.respondWith(handleStream(request))
    return
  }

  // 开发环境只用流式下载，不做任何缓存，避免 HMR 看到旧资源。
  if (IS_DEV) {
    return
  }

  // 下载、服务端函数与 worker 自身都不进入缓存。
  if (
    request.headers.has('range') ||
    url.pathname === '/sw.js' ||
    SKIP_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
  ) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request))
    return
  }

  // 构建产物带内容哈希，可以长期缓存。
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request))
    return
  }

  if (CACHEABLE_DESTINATIONS.has(request.destination)) {
    event.respondWith(staleWhileRevalidate(request))
  }
})
