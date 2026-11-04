import { createFileRoute } from '@tanstack/react-router'

import type { ShareKind } from '@/lib/share-meta'

const KINDS = new Set<ShareKind>(['episode', 'podcast', 'home'])

const HOME_DEFAULTS = {
  title: '把想听的声音，留在硬盘里',
  label: '小宇宙 · 播客备份',
  description:
    '粘贴小宇宙的单集或播客链接，在线试听，也能下载音频、原封面与节目简介。',
}

function pick(value: string | null, fallback: string, maxLength: number): string {
  const text = (value ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) {
    return fallback
  }

  const chars = Array.from(text)
  return chars.length > maxLength
    ? chars.slice(0, maxLength).join('')
    : text
}

export const Route = createFileRoute('/api/og')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams
        const rawKind = params.get('kind')
        const kind: ShareKind =
          rawKind && KINDS.has(rawKind as ShareKind)
            ? (rawKind as ShareKind)
            : 'home'

        const isHome = kind === 'home'

        try {
          const { renderOgImage } = await import('@/server/og')
          const png = await renderOgImage({
            kind,
            title: pick(
              params.get('title'),
              isHome ? HOME_DEFAULTS.title : '宇宙备份',
              100,
            ),
            label: pick(
              params.get('label'),
              isHome ? HOME_DEFAULTS.label : '小宇宙 · 播客备份',
              40,
            ),
            description: pick(
              params.get('description'),
              HOME_DEFAULTS.description,
              220,
            ),
            image: params.get('image') ?? undefined,
          })

          return new Response(new Blob([png.slice().buffer as ArrayBuffer], { type: 'image/png' }), {
            headers: {
              'content-type': 'image/png',
              'content-length': String(png.byteLength),
              'cache-control':
                'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
              'x-content-type-options': 'nosniff',
            },
          })
        } catch {
          return new Response('生成分享图片失败', { status: 500 })
        }
      },
    },
  },
})
