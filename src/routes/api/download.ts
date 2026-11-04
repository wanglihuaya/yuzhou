import { createFileRoute } from '@tanstack/react-router'

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

function isAllowedUrl(url: URL): boolean {
  return (
    url.protocol === 'https:' &&
    ALLOWED_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))
  )
}

function cleanFilename(filename: string): string {
  const cleaned = filename
    .replace(/[\u0000-\u001f\u007f\r\n]/g, '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return (cleaned || 'download').slice(0, 180)
}

function contentDisposition(filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  )

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

async function fetchFollowingRedirects(
  target: URL,
  range?: string,
): Promise<Response> {
  let current = target

  for (let hop = 0; hop <= 5; hop += 1) {
    if (!isAllowedUrl(current)) {
      throw new Error('该地址不在允许下载的范围内。')
    }

    const headers = range
      ? { ...UPSTREAM_HEADERS, range }
      : UPSTREAM_HEADERS

    const response = await fetch(current, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(120_000),
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (!location) {
        throw new Error('上游返回了无效的跳转地址。')
      }
      current = new URL(location, current)
      continue
    }

    return response
  }

  throw new Error('跳转次数过多。')
}

export const Route = createFileRoute('/api/download')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestUrl = new URL(request.url)
        const rawUrl = requestUrl.searchParams.get('url')
        const filename = cleanFilename(
          requestUrl.searchParams.get('filename') ?? 'download',
        )

        if (!rawUrl) {
          return new Response('缺少下载地址', { status: 400 })
        }

        let target: URL
        try {
          target = new URL(rawUrl)
        } catch {
          return new Response('下载地址无效', { status: 400 })
        }

        if (!isAllowedUrl(target)) {
          return new Response('该地址不在允许下载的范围内', { status: 403 })
        }

        let upstream: Response
        try {
          upstream = await fetchFollowingRedirects(
            target,
            request.headers.get('range') ?? undefined,
          )
        } catch (error) {
          const message =
            error instanceof Error ? error.message : '上游请求失败'
          return new Response(message, { status: 502 })
        }

        if (!upstream.ok || !upstream.body) {
          return new Response(`下载失败（HTTP ${upstream.status}）`, {
            status: upstream.status === 404 ? 404 : 502,
          })
        }

        const headers = new Headers()
        const contentType = upstream.headers.get('content-type')
        const contentRange = upstream.headers.get('content-range')
        const contentLength = upstream.headers.get('content-length')
        const contentEncoding = upstream.headers.get('content-encoding')

        if (contentType) {
          headers.set('content-type', contentType)
        }
        if (contentRange) {
          headers.set('content-range', contentRange)
        }
        if (contentLength && !contentEncoding) {
          headers.set('content-length', contentLength)
        }

        headers.set(
          'accept-ranges',
          upstream.headers.get('accept-ranges') ?? 'bytes',
        )
        headers.set('content-disposition', contentDisposition(filename))
        headers.set('cache-control', 'public, max-age=3600')
        headers.set('x-content-type-options', 'nosniff')

        return new Response(upstream.body, {
          status: upstream.status,
          headers,
        })
      },
    },
  },
})
