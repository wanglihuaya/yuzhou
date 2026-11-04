import { createServerFn } from '@tanstack/react-start'

import { sanitizeHtml } from './sanitize'

const PAGE_ORIGIN = 'https://www.xiaoyuzhoufm.com'
const CACHE_TTL = 5 * 60 * 1000
const CACHE_LIMIT = 60

const REQUEST_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
}

const AUDIO_EXTENSIONS = [
  'mp3',
  'm4a',
  'wav',
  'ogg',
  'flac',
  'ape',
  'aac',
  'aiff',
  'wma',
  'webm',
] as const

const IMAGE_FORMAT_TO_EXT: Record<string, string> = {
  jpeg: 'jpg',
  jpg: 'jpg',
  png: 'png',
  webp: 'webp',
  gif: 'gif',
  svg: 'svg',
  avif: 'avif',
  heic: 'heic',
  heif: 'heif',
  bmp: 'bmp',
  tiff: 'tiff',
}

const MIME_TO_AUDIO_EXT: Record<string, string> = {
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/webm': 'webm',
}

export interface ImageAsset {
  url: string
  ext: string
}

export interface Episode {
  eid: string
  pid: string
  title: string
  description: string
  shownotes: string
  duration: number
  pubDate: string
  playCount: number
  commentCount: number
  clapCount: number
  favoriteCount: number
  audioUrl: string
  audioExt: string
  audioSize: number
  audioMime: string
  imageUrl: string
  imageExt: string
  payType: string
  isPrivate: boolean
  podcast: {
    pid: string
    title: string
    author: string
    imageUrl: string
    imageExt: string
  }
}

export interface Podcaster {
  nickname: string
  avatar: ImageAsset | null
}

export interface CommentAuthor {
  nickname: string
  avatar: string
  ipLoc: string
}

export interface CommentReply {
  id: string
  text: string
  createdAt: string
  likeCount: number
  author: CommentAuthor
  replyTo: string
}

export interface EpisodeComment {
  id: string
  text: string
  createdAt: string
  likeCount: number
  pinned: boolean
  authorAssociation: string
  author: CommentAuthor
  replies: CommentReply[]
  replyCount: number
}

export interface Podcast {
  pid: string
  title: string
  author: string
  description: string
  subscriptionCount: number
  episodeCount: number
  latestEpisodePubDate: string
  imageUrl: string
  imageExt: string
  podcasters: Podcaster[]
}

export type ResolvedData =
  | { kind: 'episode'; episode: Episode; comments: EpisodeComment[] }
  | {
      kind: 'podcast'
      podcast: Podcast
      episodes: Episode[]
      hasMore: boolean
    }

export type ResolveResult =
  | { ok: true; data: ResolvedData }
  | { ok: false; error: string }

type Raw = Record<string, any>

const pageCache = new Map<
  string,
  { at: number; value: { status: number; pageProps: Raw | null; error?: string } }
>()

function asRecord(value: unknown): Raw | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Raw)
    : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function bool(value: unknown): boolean {
  return value === true
}

function stripImageSuffix(url: string): string {
  const pattern = /@(thumbnail|small|middle|large)$/i
  try {
    const parsed = new URL(url)
    parsed.pathname = parsed.pathname.replace(pattern, '')
    return parsed.toString()
  } catch {
    return url.replace(pattern, '')
  }
}

function imageAsset(value: unknown): ImageAsset | null {
  const image = asRecord(value)
  if (!image) {
    return null
  }

  const rawUrl =
    str(image.picUrl) ||
    str(image.largePicUrl) ||
    str(image.middlePicUrl) ||
    str(image.smallPicUrl)

  if (!rawUrl) {
    return null
  }

  const url = stripImageSuffix(rawUrl)
  const format = str(image.format).toLowerCase()

  return {
    url,
    ext: IMAGE_FORMAT_TO_EXT[format] ?? imageExtFromUrl(url),
  }
}

function imageExtFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname.toLowerCase()
    const match = path.match(/\.([a-z0-9]{2,5})$/)
    const ext = match?.[1]
    if (ext && ext in IMAGE_FORMAT_TO_EXT) {
      return IMAGE_FORMAT_TO_EXT[ext]
    }
    return ext && ext.length <= 4 ? ext : 'jpg'
  } catch {
    return 'jpg'
  }
}

function audioExtFromUrl(url: string, mime: string): string {
  try {
    const path = new URL(url).pathname.toLowerCase()
    const match = AUDIO_EXTENSIONS.find((ext) => path.endsWith(`.${ext}`))
    if (match) {
      return match
    }
  } catch {
    // Fall through to the MIME type.
  }

  return MIME_TO_AUDIO_EXT[mime.toLowerCase()] ?? 'm4a'
}

function normalizePodcast(raw: Raw): Podcast {
  const image = imageAsset(raw.image)
  const podcasters = asArray(raw.podcasters)
    .map((item) => {
      const podcaster = asRecord(item)
      if (!podcaster) {
        return null
      }
      const avatar = imageAsset(asRecord(podcaster.avatar)?.picture)
      const nickname = str(podcaster.nickname)
      return nickname ? { nickname, avatar } : null
    })
    .filter((item): item is Podcaster => item !== null)

  return {
    pid: str(raw.pid),
    title: str(raw.title),
    author: str(raw.author),
    description: str(raw.description),
    subscriptionCount: num(raw.subscriptionCount),
    episodeCount: num(raw.episodeCount),
    latestEpisodePubDate: str(raw.latestEpisodePubDate),
    imageUrl: image?.url ?? '',
    imageExt: image?.ext ?? 'jpg',
    podcasters,
  }
}

function normalizeEpisode(raw: Raw, fallbackPodcast?: Podcast): Episode {
  const rawPodcast = asRecord(raw.podcast)
  const podcast = fallbackPodcast ?? normalizePodcast(rawPodcast ?? {})
  const image = imageAsset(raw.image)
  const media = asRecord(raw.media)
  const source = asRecord(media?.source)
  const enclosure = asRecord(raw.enclosure)
  const audioUrl = str(enclosure?.url) || str(source?.url)
  const audioMime = str(media?.mimeType)

  return {
    eid: str(raw.eid),
    pid: str(raw.pid) || podcast.pid,
    title: str(raw.title) || '未命名单集',
    description: str(raw.description),
    shownotes: sanitizeHtml(str(raw.shownotes)),
    duration: num(raw.duration),
    pubDate: str(raw.pubDate),
    playCount: num(raw.playCount),
    commentCount: num(raw.commentCount),
    clapCount: num(raw.clapCount),
    favoriteCount: num(raw.favoriteCount),
    audioUrl,
    audioExt: audioExtFromUrl(audioUrl, audioMime),
    audioSize: num(media?.size),
    audioMime,
    imageUrl: image?.url ?? podcast.imageUrl,
    imageExt: image?.ext ?? podcast.imageExt,
    payType: str(raw.payType) || 'FREE',
    isPrivate: bool(raw.isPrivateMedia),
    podcast: {
      pid: podcast.pid,
      title: podcast.title,
      author: podcast.author,
      imageUrl: podcast.imageUrl,
      imageExt: podcast.imageExt,
    },
  }
}

function normalizeCommentAuthor(value: unknown): CommentAuthor {
  const author = asRecord(value) ?? {}
  const avatar = imageAsset(asRecord(author.avatar)?.picture)

  return {
    nickname: str(author.nickname),
    avatar: avatar?.url ?? '',
    ipLoc: str(author.ipLoc),
  }
}

function normalizeCommentReply(value: Raw): CommentReply {
  const replyTo = asRecord(value.replyToComment)
  const replyToAuthor = asRecord(replyTo?.author)
  const author = normalizeCommentAuthor(value.author)

  if (!author.ipLoc) {
    author.ipLoc = str(value.ipLoc)
  }

  return {
    id: str(value.id),
    text: str(value.text),
    createdAt: str(value.createdAt),
    likeCount: num(value.likeCount),
    author,
    replyTo: str(replyToAuthor?.nickname),
  }
}

function normalizeComment(value: Raw): EpisodeComment {
  const replies = asArray(value.replies)
    .map((item) => asRecord(item))
    .filter((item): item is Raw => item !== null)
    .map(normalizeCommentReply)
    .filter((reply) => reply.text)

  const author = normalizeCommentAuthor(value.author)
  if (!author.ipLoc) {
    author.ipLoc = str(value.ipLoc)
  }

  return {
    id: str(value.id),
    text: str(value.text),
    createdAt: str(value.createdAt),
    likeCount: num(value.likeCount),
    pinned: bool(value.pinned),
    authorAssociation: str(value.authorAssociation),
    author,
    replies,
    replyCount: Math.max(num(value.replyCount), replies.length),
  }
}

function parseNextData(html: string): Raw | null {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  )
  if (!match?.[1]) {
    return null
  }

  try {
    return asRecord(JSON.parse(match[1]))
  } catch {
    return null
  }
}

type PageKind = 'episode' | 'podcast'

interface PageLoadResult {
  status: number
  pageProps: Raw | null
  error?: string
}

async function loadPage(kind: PageKind, id: string): Promise<PageLoadResult> {
  const cacheKey = `${kind}:${id}`
  const cached = pageCache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return cached.value
  }

  let response: Response
  try {
    response = await fetch(`${PAGE_ORIGIN}/${kind}/${id}`, {
      headers: REQUEST_HEADERS,
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    return {
      status: 0,
      pageProps: null,
      error: '无法连接小宇宙，请稍后重试。',
    }
  }

  if (response.status === 404) {
    return { status: 404, pageProps: null }
  }

  if (!response.ok) {
    return {
      status: response.status,
      pageProps: null,
      error: `小宇宙页面请求失败（HTTP ${response.status}）。`,
    }
  }

  const html = await response.text()
  const nextData = parseNextData(html)
  const pageProps = asRecord(asRecord(nextData?.props)?.pageProps)

  if (!pageProps) {
    return {
      status: response.status,
      pageProps: null,
      error: '页面结构发生变化，暂时无法解析这期内容。',
    }
  }

  const result: PageLoadResult = { status: response.status, pageProps }

  if (pageCache.size >= CACHE_LIMIT) {
    const oldest = pageCache.keys().next().value
    if (oldest) {
      pageCache.delete(oldest)
    }
  }
  pageCache.set(cacheKey, { at: Date.now(), value: result })

  return result
}

function toEpisodeResult(pageProps: Raw): ResolveResult {
  if (pageProps.statusCode === 404) {
    return { ok: false, error: '这期节目不存在或已被删除。' }
  }

  const episode = asRecord(pageProps.episode)
  if (!episode) {
    return { ok: false, error: '没有在这页找到单集数据，请确认链接是否完整。' }
  }

  const normalized = normalizeEpisode(episode)
  if (!normalized.audioUrl) {
    return {
      ok: false,
      error: '这期节目没有公开的音频地址，可能是付费或已下架内容。',
    }
  }

  const comments = asArray(pageProps.comments)
    .map((item) => asRecord(item))
    .filter((item): item is Raw => item !== null)
    .map(normalizeComment)
    .filter((comment) => comment.id && comment.text)

  return { ok: true, data: { kind: 'episode', episode: normalized, comments } }
}

function toPodcastResult(pageProps: Raw): ResolveResult {
  if (pageProps.statusCode === 404) {
    return { ok: false, error: '这个播客不存在或已被删除。' }
  }

  const rawPodcast = asRecord(pageProps.podcast)
  if (!rawPodcast) {
    return { ok: false, error: '没有在这页找到播客数据，请确认链接是否完整。' }
  }

  const podcast = normalizePodcast(rawPodcast)
  const episodes = asArray(rawPodcast.episodes)
    .map((item) => asRecord(item))
    .filter((item): item is Raw => item !== null)
    .map((item) => normalizeEpisode(item, podcast))

  return {
    ok: true,
    data: {
      kind: 'podcast',
      podcast,
      episodes,
      hasMore: podcast.episodeCount > episodes.length,
    },
  }
}

interface ParsedInput {
  kind: PageKind | 'id'
  id: string
}

export function parseXiaoyuzhouInput(raw: string): ParsedInput | null {
  const value = raw.trim()
  if (!value) {
    return null
  }

  const idOnly = value.match(/^[0-9a-zA-Z]{24}$/)
  if (idOnly) {
    return { kind: 'id', id: idOnly[0] }
  }

  const urlMatch = value.match(/https?:\/\/[^\s"'<>，。；]+/i)
  const candidate = urlMatch?.[0] ?? value
  let url: URL
  try {
    url = new URL(candidate.includes('://') ? candidate : `https://${candidate}`)
  } catch {
    return null
  }

  if (!/(^|\.)xiaoyuzhoufm\.com$/i.test(url.hostname)) {
    return null
  }

  const match = url.pathname.match(/\/(episode|podcast)\/([0-9a-zA-Z]{24})/)
  if (!match) {
    return null
  }

  return { kind: match[1] as PageKind, id: match[2] }
}

async function resolveInput(raw: string): Promise<ResolveResult> {
  const parsed = parseXiaoyuzhouInput(raw)
  if (!parsed) {
    return {
      ok: false,
      error: '请输入小宇宙的单集或播客链接，例如 https://www.xiaoyuzhoufm.com/episode/…',
    }
  }

  if (parsed.kind === 'episode') {
    const page = await loadPage('episode', parsed.id)
    if (page.error) {
      return { ok: false, error: page.error }
    }
    if (page.status === 404) {
      return { ok: false, error: '这期节目不存在或已被删除。' }
    }
    return toEpisodeResult(page.pageProps ?? {})
  }

  if (parsed.kind === 'podcast') {
    const page = await loadPage('podcast', parsed.id)
    if (page.error) {
      return { ok: false, error: page.error }
    }
    if (page.status === 404) {
      return { ok: false, error: '这个播客不存在或已被删除。' }
    }
    return toPodcastResult(page.pageProps ?? {})
  }

  const episodePage = await loadPage('episode', parsed.id)
  if (episodePage.pageProps && episodePage.status !== 404) {
    return toEpisodeResult(episodePage.pageProps)
  }

  const podcastPage = await loadPage('podcast', parsed.id)
  if (podcastPage.pageProps && podcastPage.status !== 404) {
    return toPodcastResult(podcastPage.pageProps)
  }

  if (episodePage.error || podcastPage.error) {
    return {
      ok: false,
      error: episodePage.error || podcastPage.error || '解析失败，请稍后重试。',
    }
  }

  return { ok: false, error: '没有找到对应的单集或播客，请检查 ID 是否正确。' }
}

export const resolveXiaoyuzhou = createServerFn({ method: 'GET' })
  .validator((input: unknown) => {
    if (typeof input !== 'string' || !input.trim()) {
      throw new Error('请输入小宇宙链接')
    }
    return input.trim()
  })
  .handler(async ({ data }): Promise<ResolveResult> => {
    try {
      return await resolveInput(data)
    } catch {
      return {
        ok: false,
        error: '解析时出现了意外错误，请稍后重试。',
      }
    }
  })

export function sanitizeFilename(value: string, maxLength = 90): string {
  const cleaned = value
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const safe = Array.from(cleaned || '未命名')
  return safe.slice(0, maxLength).join('')
}

export function audioFilename(episode: Episode): string {
  return `${sanitizeFilename(episode.title)} - ${sanitizeFilename(
    episode.podcast.title,
  )}.${episode.audioExt}`
}

export function coverFilename(title: string, ext: string): string {
  return `${sanitizeFilename(title)} - 封面.${ext || 'jpg'}`
}

export function avatarFilename(nickname: string, ext: string): string {
  return `${sanitizeFilename(nickname)} - 头像.${ext || 'jpg'}`
}

export function notesFilename(title: string): string {
  return `${sanitizeFilename(title)} - 简介.txt`
}

export function downloadHref(url: string, filename: string): string {
  return `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(
    filename,
  )}`
}
