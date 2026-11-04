/**
 * Cloudflare Worker for www.xiaoyuzhoufm.dev.
 *
 * The TanStack Start app runs on the upstream server configured by the ORIGIN
 * secret. This Worker is a transparent reverse proxy so a URL whose host has
 * been changed from xiaoyuzhoufm.com to xiaoyuzhoufm.dev keeps its path and is
 * served by the same app. The upstream is fixed, so this is not an open proxy.
 *
 * Set the upstream after deploying the Worker:
 *   npx wrangler secret put ORIGIN
 * For local development, put ORIGIN=https://… in .dev.vars (gitignored).
 * Deploy with: cd cloudflare && npx wrangler deploy
 */

const APEX_HOST = 'xiaoyuzhoufm.dev'
const WWW_HOST = 'www.xiaoyuzhoufm.dev'

/** Only an https origin without a path is accepted. */
function readOrigin(env) {
  const raw = typeof env?.ORIGIN === 'string' ? env.ORIGIN.trim() : ''
  if (!raw) {
    return null
  }

  try {
    const url = new URL(raw)
    if (
      url.protocol !== 'https:' ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      return null
    }
    return url.origin
  } catch {
    return null
  }
}

export default {
  async fetch(request, env) {
    const origin = readOrigin(env)
    if (!origin) {
      return new Response('Worker 未配置 ORIGIN，请先执行 wrangler secret put ORIGIN。', {
        status: 500,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }

    const url = new URL(request.url)

    // .dev is HSTS-preloaded; send the apex to the canonical www host.
    if (url.hostname === APEX_HOST) {
      url.hostname = WWW_HOST
      return Response.redirect(url.toString(), 301)
    }

    if (url.hostname !== WWW_HOST) {
      return new Response('Not Found', { status: 404 })
    }

    const target = new URL(url.pathname + url.search, origin)
    const headers = new Headers(request.headers)
    // fetch() derives Host from the target URL.
    headers.delete('host')
    headers.set('X-Forwarded-Host', url.host)
    headers.set('X-Forwarded-Proto', 'https')

    const init = {
      method: request.method,
      headers,
      redirect: 'manual',
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body
    }

    let upstream
    try {
      upstream = await fetch(new Request(target, init))
    } catch {
      return new Response('上游服务暂时不可用，请稍后重试。', {
        status: 502,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }

    const response = new Response(upstream.body, upstream)
    // Absolute redirects from the origin must not take the browser back to
    // the upstream host while it is browsing the alias domain.
    const location = response.headers.get('location')
    if (location) {
      const redirect = new URL(location, target)
      if (redirect.origin === origin) {
        redirect.protocol = url.protocol
        redirect.host = url.host
        response.headers.set('location', redirect.toString())
      }
    }

    // The alias exists for convenience, not for search discovery.
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')

    return response
  },
}
