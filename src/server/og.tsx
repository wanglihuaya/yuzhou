import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

import { Resvg, initWasm } from '@resvg/resvg-wasm'
import satori from 'satori'

import logoUrl from '@/assets/logo.png?inline'
import fontRegularUrl from '@/assets/fonts/noto-sans-sc-400.woff?inline'
import fontBoldUrl from '@/assets/fonts/noto-sans-sc-700.woff?inline'

import { Photo } from '@/components/og/photo'
import { Simple } from '@/components/og/simple'
import type { ShareKind } from '@/lib/share-meta'

export interface OgRenderInput {
  kind: ShareKind
  title: string
  label: string
  description: string
  image?: string
}

const WIDTH = 1200
const HEIGHT = 630

const IMAGE_HOST_PATTERNS = [
  /(^|\.)xyzcdn\.net$/i,
  /(^|\.)xiaoyuzhoufm\.com$/i,
]

const UPSTREAM_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  referer: 'https://www.xiaoyuzhoufm.com/',
  accept: 'image/avif,image/webp,image/png,image/jpeg,*/*',
}

function dataUrlBytes(dataUrl: string): Buffer {
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
}

let setupPromise:
  | Promise<{ regular: Buffer; bold: Buffer }>
  | undefined

/** Load the CJK font once and initialise the rasteriser. */
function setup() {
  setupPromise ??= (async () => {
    const require = createRequire(import.meta.url)
    const wasm = readFileSync(
      require.resolve('@resvg/resvg-wasm/index_bg.wasm'),
    )
    await initWasm(wasm)

    return {
      regular: dataUrlBytes(fontRegularUrl),
      bold: dataUrlBytes(fontBoldUrl),
    }
  })().catch((error) => {
    setupPromise = undefined
    throw error
  })

  return setupPromise
}

/** Inline the cover so Satori never has to reach the CDN itself. */
async function coverDataUrl(raw: string | undefined): Promise<string | undefined> {
  if (!raw) {
    return undefined
  }

  try {
    const url = new URL(raw)
    if (
      url.protocol !== 'https:' ||
      !IMAGE_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))
    ) {
      return undefined
    }

    const response = await fetch(url, {
      headers: UPSTREAM_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(6_000),
    })
    if (!response.ok) {
      return undefined
    }

    const contentType = (response.headers.get('content-type') ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase()
    if (!/^image\/(jpeg|png|gif|webp)$/.test(contentType)) {
      return undefined
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.byteLength > 8 * 1024 * 1024) {
      return undefined
    }

    return `data:${contentType};base64,${buffer.toString('base64')}`
  } catch {
    return undefined
  }
}

const cache = new Map<string, Uint8Array>()
const CACHE_LIMIT = 48

function remember(key: string, png: Uint8Array): void {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) {
      cache.delete(oldest)
    }
  }
  cache.set(key, png)
}

export async function renderOgImage(input: OgRenderInput): Promise<Uint8Array> {
  const key = JSON.stringify(input)
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }

  const [{ regular, bold }, image] = await Promise.all([
    setup(),
    coverDataUrl(input.image),
  ])

  const logo = logoUrl as string

  const element =
    input.kind === 'home' ? (
      <Simple
        brand="宇宙备份"
        description={input.description}
        label={input.label}
        logo={logo}
        title={input.title}
      />
    ) : (
      <Photo
        brand="宇宙备份"
        image={image}
        label={input.label}
        logo={logo}
        title={input.title}
      />
    )

  const svg = await satori(element, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: 'Noto Sans SC', data: regular, weight: 400, style: 'normal' },
      { name: 'Noto Sans SC', data: bold, weight: 700, style: 'normal' },
    ],
  })

  const png = new Resvg(svg).render().asPng()

  const bytes = new Uint8Array(png)
  remember(key, bytes)
  return bytes
}
