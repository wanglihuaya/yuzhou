import { createServerFn } from '@tanstack/react-start'

import { htmlToText } from './format'
import { SITE_NAME, SITE_URL } from './site'
import { type ResolvedData, resolveXiaoyuzhou } from './xiaoyuzhou'

export { SITE_URL }

export type ShareKind = 'episode' | 'podcast' | 'home'

export interface ShareMeta {
  kind: ShareKind
  /** Headline of the share card. */
  title: string
  /** Small pill above the headline. */
  label: string
  description: string
  image?: string
  /** Canonical app path this card belongs to. */
  path: string
}

export interface ShareMetaResult {
  origin: string
  meta: ShareMeta | null
}

/**
 * Social crawlers do not run JavaScript, so the per-page card is resolved on
 * the server only for them. Regular visitors get `meta: null` immediately and
 * keep the existing client-side resolution flow.
 */
const CRAWLER_RE =
  /bot|crawler|spider|slurp|facebookexternalhit|facebot|twitterbot|slackbot|telegrambot|discordbot|whatsapp|linkedinbot|pinterest|embedly|redditbot|applebot|bingpreview|yandex|baiduspider|sogou|360spider|micromessenger/i

function trimText(value: string, maxLength: number): string {
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const chars = Array.from(cleaned)
  return chars.length > maxLength
    ? `${chars.slice(0, maxLength).join('')}…`
    : cleaned
}

function metaFor(data: ResolvedData): ShareMeta {
  if (data.kind === 'episode') {
    const { episode } = data
    const description =
      htmlToText(episode.description) || htmlToText(episode.shownotes)
    return {
      kind: 'episode',
      title: trimText(episode.title, 60),
      label: trimText(`单集 · ${episode.podcast.title}`, 28),
      description: trimText(description, 120),
      image: episode.imageUrl,
      path: `/episode/${episode.eid}`,
    }
  }

  return {
    kind: 'podcast',
    title: trimText(data.podcast.title, 60),
    label: trimText(`播客 · ${data.podcast.author}`, 28),
    description: trimText(htmlToText(data.podcast.description), 120),
    image: data.podcast.imageUrl,
    path: `/podcast/${data.podcast.pid}`,
  }
}

export const getShareMeta = createServerFn({ method: 'GET' })
  .validator((input: unknown) => {
    if (typeof input !== 'string') {
      return ''
    }
    return input.trim().slice(0, 2048)
  })
  .handler(async ({ data }): Promise<ShareMetaResult> => {
    let origin = ''
    let userAgent = ''

    try {
      const { getRequestHeader, getRequestUrl, setResponseHeader } =
        await import('@tanstack/react-start/server')
      origin = getRequestUrl({ xForwardedHost: true }).origin
      userAgent = getRequestHeader('user-agent') ?? ''
      // The SSR document differs for crawlers, so no shared cache should
      // hand a crawler a JS-visitor copy (or the other way around).
      setResponseHeader('vary', 'User-Agent')
    } catch {
      // Requests outside a Start request context (build-time, tests) simply
      // get no per-page metadata.
    }

    if (!data || !CRAWLER_RE.test(userAgent)) {
      return { origin, meta: null }
    }

    try {
      const result = await resolveXiaoyuzhou({ data })
      if (!result.ok) {
        return { origin, meta: null }
      }
      return { origin, meta: metaFor(result.data) }
    } catch {
      return { origin, meta: null }
    }
  })

/**
 * Route loaders only need share metadata while the document is rendered on
 * the server; crawlers never navigate client-side. Returning null during
 * client-side navigation keeps that transition free of an extra RPC.
 */
export async function loaderShareMeta(
  raw: string | undefined,
): Promise<ShareMetaResult | null> {
  if (!raw || typeof window !== 'undefined') {
    return null
  }
  return getShareMeta({ data: raw })
}

/** Build the absolute URL of the generated OG image. */
export function ogImageUrl(origin: string, meta: ShareMeta): string {
  const params = new URLSearchParams({
    kind: meta.kind,
    title: meta.title,
    label: meta.label,
  })
  if (meta.kind === 'home') {
    params.set('description', meta.description)
  }
  if (meta.image) {
    params.set('image', meta.image)
  }
  return `${origin || SITE_URL}/api/og?${params.toString()}`
}

/**
 * Head tags for a crawler-rendered page. Returns undefined when there is no
 * per-page metadata, so the root document's defaults stay in place.
 */
export function shareHead(result: ShareMetaResult | null | undefined) {
  const meta = result?.meta
  if (!result || !meta) {
    return { meta: [] }
  }

  const origin = result.origin || SITE_URL
  const image = ogImageUrl(origin, meta)
  const title = `${meta.title} · 宇宙备份`
  const url = `${origin}${meta.path}`

  return {
    meta: [
      { title },
      { name: 'description', content: meta.description },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: meta.title },
      { property: 'og:description', content: meta.description },
      { property: 'og:url', content: url },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:locale', content: 'zh_CN' },
      { property: 'og:image', content: image },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: meta.title },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: meta.title },
      { name: 'twitter:description', content: meta.description },
      { name: 'twitter:image', content: image },
    ],
  }
}
