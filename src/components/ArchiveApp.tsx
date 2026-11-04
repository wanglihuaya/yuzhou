import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  AlertCircle,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Disc3,
  Download,
  ExternalLink,
  FileText,
  HardDrive,
  ImageDown,
  Layers,
  Link2,
  ListMusic,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Play,
  Radio,
  Smartphone,
  Sparkles,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  addRecent,
  copyText,
  downloadText,
  loadRecent,
  sleep,
  triggerDownload,
  type RecentItem,
} from '@/lib/browser'
import { formatBytes, formatCount, formatDate, formatDuration } from '@/lib/format'
import {
  absoluteHref,
  isWeChatBrowser,
  signalWeChatDownloadBlocked,
  WECHAT_BLOCKED_EVENT,
  type WeChatBlockedDetail,
} from '@/lib/wechat'
import {
  audioFilename,
  avatarFilename,
  coverFilename,
  downloadHref,
  notesFilename,
  resolveXiaoyuzhou,
  type Episode,
  type Podcast,
  type ResolvedData,
} from '@/lib/xiaoyuzhou'
import { cn } from '@/lib/utils'

const EXAMPLE_EPISODE =
  'https://www.xiaoyuzhoufm.com/episode/6ae967cec96c8942ec167f82'
const EXAMPLE_PODCAST =
  'https://www.xiaoyuzhoufm.com/podcast/682c566cc7c5f17595635a2c'
const BASE_TITLE = '宇宙备份 · 小宇宙音频与封面下载'

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface ArchiveAppProps {
  urlParam?: string
  onUrlChange: (url: string) => void
}

interface WeChatHintState {
  open: boolean
  href?: string
}

function canonicalUrl(data: ResolvedData): string {
  return data.kind === 'episode'
    ? `https://www.xiaoyuzhoufm.com/episode/${data.episode.eid}`
    : `https://www.xiaoyuzhoufm.com/podcast/${data.podcast.pid}`
}

function recentlyResolved(data: ResolvedData): RecentItem {
  if (data.kind === 'episode') {
    return {
      url: canonicalUrl(data),
      title: data.episode.title,
      subtitle: data.episode.podcast.title,
      kind: 'episode',
      image: data.episode.imageUrl,
      at: Date.now(),
    }
  }

  return {
    url: canonicalUrl(data),
    title: data.podcast.title,
    subtitle: data.podcast.author,
    kind: 'podcast',
    image: data.podcast.imageUrl,
    at: Date.now(),
  }
}

function isPaid(episode: Episode): boolean {
  return episode.payType !== 'FREE' || episode.isPrivate
}

/** Downloads cannot start inside WeChat's webview; explain instead of failing. */
function guardedDownload(href: string): void {
  if (isWeChatBrowser()) {
    signalWeChatDownloadBlocked(href)
    return
  }
  triggerDownload(href)
}

/** An anchor download that hands over to the WeChat explanation when needed. */
function DownloadLink({
  href,
  onClick,
  children,
  ...props
}: ComponentProps<'a'> & { href: string }) {
  return (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) {
          return
        }
        if (isWeChatBrowser()) {
          event.preventDefault()
          signalWeChatDownloadBlocked(href)
        }
      }}
    >
      {children}
    </a>
  )
}

export function ArchiveApp({ urlParam, onUrlChange }: ArchiveAppProps) {
  const [input, setInput] = useState(urlParam ?? '')
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<ResolvedData | null>(null)
  const [error, setError] = useState('')
  const [recent, setRecent] = useState<RecentItem[]>([])
  const [batch, setBatch] = useState<'audio' | 'cover' | null>(null)
  const [inWeChat, setInWeChat] = useState(false)
  const [wechatHint, setWechatHint] = useState<WeChatHintState>({
    open: false,
  })

  const requestSeq = useRef(0)
  const lastResolved = useRef<string | null>(null)
  const resultRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setRecent(loadRecent())
    setInWeChat(isWeChatBrowser())
  }, [])

  useEffect(() => {
    const onBlocked = (event: Event) => {
      const detail = (event as CustomEvent<WeChatBlockedDetail>).detail
      setWechatHint({ open: true, href: detail?.href })
    }

    window.addEventListener(WECHAT_BLOCKED_EVENT, onBlocked)
    return () => {
      window.removeEventListener(WECHAT_BLOCKED_EVENT, onBlocked)
    }
  }, [])

  useEffect(() => {
    if (!result) {
      document.title = BASE_TITLE
      return
    }

    document.title =
      result.kind === 'episode'
        ? `${result.episode.title} · ${result.episode.podcast.title} · 宇宙备份`
        : `${result.podcast.title} · 宇宙备份`
  }, [result])

  const runResolve = useCallback(
    async (raw: string, options?: { scroll?: boolean }) => {
      const seq = requestSeq.current + 1
      requestSeq.current = seq
      setStatus('loading')
      setError('')
      setResult(null)

      try {
        const response = await resolveXiaoyuzhou({ data: raw })
        if (requestSeq.current !== seq) {
          return
        }

        if (!response.ok) {
          setError(response.error)
          setStatus('error')
          return
        }

        setResult(response.data)
        setStatus('ready')
        setRecent(addRecent(recentlyResolved(response.data)))

        if (options?.scroll) {
          window.setTimeout(() => {
            resultRef.current?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            })
          }, 80)
        }
      } catch {
        if (requestSeq.current !== seq) {
          return
        }
        setError('网络请求失败，请稍后重试。')
        setStatus('error')
      }
    },
    [],
  )

  useEffect(() => {
    if (!urlParam || lastResolved.current === urlParam) {
      return
    }
    lastResolved.current = urlParam
    setInput(urlParam)
    void runResolve(urlParam)
  }, [urlParam, runResolve])

  function resolveAndTrack(raw: string, scroll = true) {
    const value = raw.trim()
    if (!value) {
      return
    }

    setInput(value)

    if (value === urlParam) {
      lastResolved.current = value
      void runResolve(value, { scroll })
    } else {
      onUrlChange(value)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    resolveAndTrack(input)
  }

  async function copyPageLink() {
    if (typeof window === 'undefined') {
      return
    }
    const copied = await copyText(window.location.href)
    if (copied) {
      toast.success('本页链接已复制', {
        description: '打开系统浏览器，粘贴访问后即可下载。',
      })
    } else {
      toast.error('复制失败，请长按地址栏手动复制')
    }
  }

  async function copyDownloadLink(href: string) {
    const copied = await copyText(absoluteHref(href))
    if (copied) {
      toast.success('下载地址已复制', {
        description: '粘贴到系统浏览器打开即可保存文件。',
      })
    } else {
      toast.error('复制失败，请稍后重试')
    }
  }

  async function runAudioBatch(episodes: Episode[], title: string) {
    if (isWeChatBrowser()) {
      signalWeChatDownloadBlocked()
      return
    }

    const downloadable = episodes.filter(
      (episode) =>
        episode.audioUrl && !isPaid(episode) && episode.payType === 'FREE',
    )

    if (downloadable.length === 0) {
      toast.error('这批内容里没有可公开下载的音频。')
      return
    }

    setBatch('audio')
    try {
      for (let index = 0; index < downloadable.length; index += 1) {
        const episode = downloadable[index]
        triggerDownload(
          downloadHref(episode.audioUrl, audioFilename(episode)),
        )
        if (index < downloadable.length - 1) {
          await sleep(800)
        }
      }
      toast.success(`已发起 ${downloadable.length} 个音频下载`, {
        description: `${title} · 浏览器若提示“下载多个文件”，请选择允许。`,
      })
    } finally {
      setBatch(null)
    }
  }

  async function runCoverBatch(episodes: Episode[], title: string) {
    if (isWeChatBrowser()) {
      signalWeChatDownloadBlocked()
      return
    }

    const downloadable = episodes.filter((episode) => episode.imageUrl)

    if (downloadable.length === 0) {
      toast.error('没有找到可下载的封面。')
      return
    }

    setBatch('cover')
    try {
      for (let index = 0; index < downloadable.length; index += 1) {
        const episode = downloadable[index]
        triggerDownload(
          downloadHref(
            episode.imageUrl,
            coverFilename(episode.title, episode.imageExt),
          ),
        )
        if (index < downloadable.length - 1) {
          await sleep(800)
        }
      }
      toast.success(`已发起 ${downloadable.length} 个封面下载`, {
        description: `${title} · 浏览器若提示“下载多个文件”，请选择允许。`,
      })
    } finally {
      setBatch(null)
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-[max(3rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-10">
      {inWeChat ? <WeChatNotice onCopy={() => void copyPageLink()} /> : null}

      <section className="animate-rise">
        <div className="glass-control inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand/60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
          </span>
          公开页面解析 · 无需登录
        </div>

        <h1 className="mt-5 max-w-3xl text-[2.5rem] leading-[1.06] font-medium tracking-[-0.04em] text-balance sm:text-6xl lg:text-[4.2rem]">
          把喜欢的声音，
          <br />
          <span className="text-muted-foreground">留在自己手里。</span>
        </h1>

        <p className="mt-5 max-w-xl text-[15px] leading-7 text-muted-foreground">
          粘贴小宇宙的单集或播客链接，解析音频、封面与节目简介。
          下载经由本站转发，文件名已经替你整理好。
        </p>

        <form onSubmit={handleSubmit} className="mt-8 max-w-2xl">
          <div className="flex flex-col gap-2 rounded-[1.4rem] bg-card p-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Link2 className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="粘贴单集 / 播客链接，或 24 位 ID"
                aria-label="小宇宙链接"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="url"
                className="h-12 rounded-[0.9rem] border-0 bg-transparent pl-10 text-base shadow-none sm:h-11 md:text-[15px]"
              />
            </div>
            <Button
              type="submit"
              disabled={status === 'loading' || !input.trim()}
              className="h-12 shrink-0 rounded-[0.9rem] px-5 text-sm sm:h-11"
            >
              {status === 'loading' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {status === 'loading' ? '解析中' : '开始解析'}
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase">
              示例
            </span>
            <ExampleChip
              label="单集 · 半拿铁"
              onClick={() => resolveAndTrack(EXAMPLE_EPISODE)}
            />
            <ExampleChip
              label="播客 · 半拿铁·周刊"
              onClick={() => resolveAndTrack(EXAMPLE_PODCAST)}
            />
          </div>
        </form>

        {recent.length > 0 ? (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              最近
            </span>
            {recent.map((item) => (
              <button
                key={item.url}
                type="button"
                onClick={() => resolveAndTrack(item.url)}
                className="glass-control flex max-w-full items-center gap-2 rounded-full py-1 pr-3 pl-1 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <Cover
                  src={item.image}
                  alt=""
                  className="size-6 rounded-full"
                />
                <span className="max-w-44 truncate">{item.title}</span>
                <span className="hidden text-muted-foreground/60 sm:inline">
                  {item.kind === 'episode' ? '单集' : '播客'}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <div ref={resultRef} className="scroll-mt-24">
        {status === 'loading' ? <LoadingPanel /> : null}

        {status === 'error' ? (
          <div
            role="alert"
            className="mt-8 animate-rise rounded-[1.4rem] bg-card p-5 sm:p-6"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-medium">没能解析这个链接</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {error}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void runResolve(input, { scroll: true })}
                    className="h-11 rounded-xl px-4 sm:h-9"
                  >
                    重试
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => resolveAndTrack(EXAMPLE_EPISODE)}
                    className="h-11 rounded-xl px-4 sm:h-9"
                  >
                    试试示例单集
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {status === 'ready' && result ? (
          <div className="mt-8 animate-rise">
            {result.kind === 'episode' ? (
              <EpisodeResult episode={result.episode} />
            ) : (
              <PodcastResult
                podcast={result.podcast}
                episodes={result.episodes}
                hasMore={result.hasMore}
                batch={batch}
                onDownloadAllAudio={() =>
                  void runAudioBatch(result.episodes, result.podcast.title)
                }
                onDownloadAllCovers={() =>
                  void runCoverBatch(result.episodes, result.podcast.title)
                }
              />
            )}
          </div>
        ) : null}
      </div>

      <HowItWorks />

      <WeChatDownloadDialog
        state={wechatHint}
        onOpenChange={(open) =>
          setWechatHint((previous) => ({ ...previous, open }))
        }
        onCopyPage={() => void copyPageLink()}
        onCopyDownload={(href) => void copyDownloadLink(href)}
      />
    </main>
  )
}

function WeChatNotice({ onCopy }: { onCopy: () => void }) {
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-[1.25rem] bg-card p-4 sm:flex-row sm:items-center">
      <span className="glass-control grid size-9 shrink-0 place-items-center rounded-full text-foreground/70">
        <Smartphone className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">微信内无法直接保存文件</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          点右上角 ···，选择「在浏览器打开」，再回到本页下载。
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={onCopy}
        className="h-10 shrink-0 rounded-xl px-3 text-xs"
      >
        <Copy className="size-3.5" />
        复制本页链接
      </Button>
    </div>
  )
}

function WeChatDownloadDialog({
  state,
  onOpenChange,
  onCopyPage,
  onCopyDownload,
}: {
  state: WeChatHintState
  onOpenChange: (open: boolean) => void
  onCopyPage: () => void
  onCopyDownload: (href: string) => void
}) {
  const steps = [
    '点右上角的 ··· 菜单',
    '选择「在浏览器打开」',
    '在浏览器里回到本页，再点下载',
  ]

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] rounded-[1.25rem] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium tracking-tight">
            微信内不能直接下载
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-6">
            微信内置浏览器会拦截文件下载。把页面交给系统浏览器，文件就能正常保存。
          </DialogDescription>
        </DialogHeader>

        <ol className="grid gap-3">
          {steps.map((step, index) => (
            <li key={step} className="flex items-start gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted font-mono text-[11px] text-muted-foreground">
                {index + 1}
              </span>
              <span className="pt-0.5 text-[13px] leading-5 text-foreground/90">
                {step}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            onClick={onCopyPage}
            className="h-11 flex-1 rounded-xl sm:h-10"
          >
            <Copy className="size-4" />
            复制本页链接
          </Button>
          {state.href ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onCopyDownload(state.href!)}
              className="h-11 flex-1 rounded-xl sm:h-10"
            >
              <Link2 className="size-4" />
              复制下载地址
            </Button>
          ) : null}
        </div>

        <p className="text-[11px] leading-5 text-muted-foreground">
          复制后打开 Safari 或系统浏览器，粘贴访问即可下载。
        </p>
      </DialogContent>
    </Dialog>
  )
}

function ExampleChip({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-control rounded-full px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
    >
      {label}
    </button>
  )
}

function Cover({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div
        className={cn(
          'grid place-items-center bg-muted text-muted-foreground',
          className,
        )}
      >
        <Disc3 className="size-1/3 opacity-50" aria-hidden="true" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  )
}

function MetaItem({
  icon,
  children,
}: {
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {children}
    </span>
  )
}

function EpisodeResult({ episode }: { episode: Episode }) {
  const description = episode.shownotes || episode.description
  const paid = isPaid(episode)
  const audioHref = episode.audioUrl
    ? downloadHref(episode.audioUrl, audioFilename(episode))
    : ''
  const originalUrl = `https://www.xiaoyuzhoufm.com/episode/${episode.eid}`

  async function handleCopyAudio() {
    const copied = await copyText(episode.audioUrl)
    if (copied) {
      toast.success('音频直链已复制')
    } else {
      toast.error('复制失败，请手动打开音频地址')
    }
  }

  function handleDownloadNotes() {
    if (isWeChatBrowser()) {
      signalWeChatDownloadBlocked()
      return
    }

    const content = [
      episode.title,
      `${episode.podcast.title}${episode.podcast.author ? ` · ${episode.podcast.author}` : ''}`,
      formatDate(episode.pubDate),
      originalUrl,
      '',
      description || '这期节目没有公开简介。',
    ].join('\n')

    downloadText(notesFilename(episode.title), content)
    toast.success('节目简介已保存')
  }

  return (
    <article className="rounded-[1.6rem] bg-card p-5 sm:p-7">
      <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-8">
        <div className="mx-auto w-full max-w-[232px] md:mx-0">
          <div className="cover-frame aspect-square overflow-hidden rounded-2xl bg-muted">
            <Cover
              src={episode.imageUrl}
              alt={`${episode.title} 封面`}
              className="h-full w-full"
            />
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-muted-foreground md:justify-start">
            <span className="inline-flex items-center gap-1">
              <Check className="size-3 text-brand" />
              原图封面
            </span>
            <span className="opacity-40">·</span>
            <span className="font-mono text-[10px] tracking-wider">
              {episode.imageExt.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="h-6 rounded-full">
              <Radio className="size-3" /> 单集
            </Badge>
            <Badge variant="outline" className="h-6 rounded-full">
              <Clock className="size-3" /> {formatDuration(episode.duration)}
            </Badge>
            {paid ? (
              <Badge variant="destructive" className="h-6 rounded-full">
                付费 / 受限
              </Badge>
            ) : (
              <Badge variant="outline" className="h-6 rounded-full">
                <span className="size-1.5 rounded-full bg-brand" />
                可下载
              </Badge>
            )}
          </div>

          <h2 className="mt-4 text-2xl leading-[1.18] font-medium tracking-[-0.025em] text-balance sm:text-[2rem]">
            {episode.title}
          </h2>

          <a
            href={`https://www.xiaoyuzhoufm.com/podcast/${episode.podcast.pid}`}
            target="_blank"
            rel="noreferrer"
            className="glass-control mt-4 inline-flex max-w-full items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm text-muted-foreground no-underline transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <Cover
              src={episode.podcast.imageUrl}
              alt=""
              className="size-6 rounded-full"
            />
            <span className="truncate">{episode.podcast.title}</span>
            {episode.podcast.author ? (
              <span className="hidden truncate opacity-70 sm:inline">
                · {episode.podcast.author}
              </span>
            ) : null}
          </a>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {episode.pubDate ? (
              <MetaItem icon={<Calendar className="size-3.5" />}>
                {formatDate(episode.pubDate)}
              </MetaItem>
            ) : null}
            <MetaItem icon={<Play className="size-3.5" />}>
              {formatCount(episode.playCount)} 次播放
            </MetaItem>
            <MetaItem icon={<MessageCircle className="size-3.5" />}>
              {formatCount(episode.commentCount)} 条评论
            </MetaItem>
            <MetaItem icon={<HardDrive className="size-3.5" />}>
              {episode.audioSize > 0
                ? `${formatBytes(episode.audioSize)} · `
                : ''}
              {episode.audioExt.toUpperCase()}
            </MetaItem>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {paid ? (
              <Button disabled className="h-11 rounded-xl px-4 sm:h-10">
                <Download className="size-4" /> 付费内容不可下载
              </Button>
            ) : (
              <Button asChild className="h-11 rounded-xl px-4 sm:h-10">
                <DownloadLink href={audioHref}>
                  <Download className="size-4" /> 下载音频
                </DownloadLink>
              </Button>
            )}

            <Button
              asChild
              variant="outline"
              className="h-11 rounded-xl px-4 sm:h-10"
            >
              <DownloadLink
                href={downloadHref(
                  episode.imageUrl,
                  coverFilename(episode.title, episode.imageExt),
                )}
              >
                <ImageDown className="size-4" /> 下载封面
              </DownloadLink>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-11 rounded-xl px-3 sm:h-10"
                  aria-label="更多操作"
                >
                  <MoreHorizontal className="size-4" />
                  更多
                  <ChevronDown className="size-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>更多操作</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => void handleCopyAudio()}>
                  <Copy className="size-4" /> 复制音频直链
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!description}
                  onClick={handleDownloadNotes}
                >
                  <FileText className="size-4" /> 下载节目简介
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => window.open(originalUrl, '_blank', 'noopener')}
                >
                  <ExternalLink className="size-4" /> 打开小宇宙原页
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {description ? (
            <details className="group mt-6 border-t border-border/60 pt-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <FileText className="size-4" />
                  节目简介
                </span>
                <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
              </summary>
              <div className="mt-3 max-h-72 overflow-y-auto pr-2 text-[13px] leading-6 whitespace-pre-wrap text-muted-foreground">
                {description}
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function PodcastResult({
  podcast,
  episodes,
  hasMore,
  batch,
  onDownloadAllAudio,
  onDownloadAllCovers,
}: {
  podcast: Podcast
  episodes: Episode[]
  hasMore: boolean
  batch: 'audio' | 'cover' | null
  onDownloadAllAudio: () => void
  onDownloadAllCovers: () => void
}) {
  const originalUrl = `https://www.xiaoyuzhoufm.com/podcast/${podcast.pid}`
  const downloadableCount = episodes.filter(
    (episode) => episode.audioUrl && !isPaid(episode),
  ).length

  async function handleCopyPodcast() {
    const copied = await copyText(originalUrl)
    if (copied) {
      toast.success('播客链接已复制')
    } else {
      toast.error('复制失败')
    }
  }

  return (
    <>
      <article className="rounded-[1.6rem] bg-card p-5 sm:p-7">
        <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-9">
          <div className="mx-auto w-full max-w-[248px] md:mx-0">
            <div className="cover-frame aspect-square overflow-hidden rounded-2xl bg-muted">
              <Cover
                src={podcast.imageUrl}
                alt={`${podcast.title} 封面`}
                className="h-full w-full"
              />
            </div>
            <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-muted-foreground md:justify-start">
              <span className="inline-flex items-center gap-1">
                <Check className="size-3 text-brand" />
                播客封面原图
              </span>
              <span className="opacity-40">·</span>
              <span className="font-mono text-[10px] tracking-wider">
                {podcast.imageExt.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="h-6 rounded-full">
                <ListMusic className="size-3" /> 播客
              </Badge>
              <Badge variant="outline" className="h-6 rounded-full">
                <Layers className="size-3" /> 共 {podcast.episodeCount} 集
              </Badge>
              {podcast.latestEpisodePubDate ? (
                <Badge variant="outline" className="h-6 rounded-full">
                  <Calendar className="size-3" />{' '}
                  {formatDate(podcast.latestEpisodePubDate)} 更新
                </Badge>
              ) : null}
            </div>

            <h2 className="mt-4 text-2xl leading-[1.15] font-medium tracking-[-0.025em] text-balance sm:text-[2rem] lg:text-[2.25rem]">
              {podcast.title}
            </h2>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted-foreground">
              {podcast.author ? (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4" />
                  {podcast.author}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <Radio className="size-4" />
                {formatCount(podcast.subscriptionCount)} 人订阅
              </span>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={onDownloadAllAudio}
                disabled={batch !== null || downloadableCount === 0}
                className="h-11 rounded-xl px-4 sm:h-10"
              >
                {batch === 'audio' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                下载全部音频（{downloadableCount}）
              </Button>

              <Button
                asChild
                variant="outline"
                className="h-11 rounded-xl px-4 sm:h-10"
              >
                <DownloadLink
                  href={downloadHref(
                    podcast.imageUrl,
                    coverFilename(podcast.title, podcast.imageExt),
                  )}
                >
                  <ImageDown className="size-4" /> 播客封面
                </DownloadLink>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl px-3 sm:h-10"
                    aria-label="更多操作"
                  >
                    <MoreHorizontal className="size-4" />
                    更多
                    <ChevronDown className="size-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>批量与更多</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={onDownloadAllCovers}
                    disabled={batch !== null}
                  >
                    <ImageDown className="size-4" /> 下载全部单集封面
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void handleCopyPodcast()}>
                    <Copy className="size-4" /> 复制播客链接
                  </DropdownMenuItem>
                  {podcast.podcasters.some((person) => person.avatar) ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>主播头像原图</DropdownMenuLabel>
                      {podcast.podcasters.map((person) =>
                        person.avatar ? (
                          <DropdownMenuItem
                            key={`${person.nickname}-${person.avatar.url}`}
                            onClick={() =>
                              guardedDownload(
                                downloadHref(
                                  person.avatar!.url,
                                  avatarFilename(
                                    person.nickname,
                                    person.avatar!.ext,
                                  ),
                                ),
                              )
                            }
                          >
                            <ImageDown className="size-4" /> {person.nickname}
                          </DropdownMenuItem>
                        ) : null,
                      )}
                    </>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      window.open(originalUrl, '_blank', 'noopener')
                    }
                  >
                    <ExternalLink className="size-4" /> 打开小宇宙原页
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {podcast.description ? (
              <details className="group mt-6 border-t border-border/60 pt-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <FileText className="size-4" />
                    播客简介
                  </span>
                  <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
                </summary>
                <div className="mt-3 max-h-64 overflow-y-auto pr-2 text-[13px] leading-6 whitespace-pre-wrap text-muted-foreground">
                  {podcast.description}
                </div>
              </details>
            ) : null}
          </div>
        </div>
      </article>

      <section className="mt-5 overflow-hidden rounded-[1.6rem] bg-card">
        <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5 pb-4 sm:px-6">
          <div>
            <h3 className="text-lg font-medium tracking-tight">最新单集</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              公开页面可读取的最新 {episodes.length} 集，逐集下载或批量带走。
            </p>
          </div>
          {hasMore ? (
            <Badge variant="outline" className="h-6 rounded-full">
              共 {podcast.episodeCount} 集 · 展示最新 {episodes.length} 集
            </Badge>
          ) : null}
        </div>

        <div className="border-t border-border/60 px-2 sm:px-3">
          {episodes.map((episode, index) => (
            <EpisodeRow
              key={episode.eid || `${episode.title}-${index}`}
              episode={episode}
              index={index + 1}
            />
          ))}
          {episodes.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              这个播客暂时没有公开单集。
            </p>
          ) : null}
        </div>

        {hasMore ? (
          <div className="border-t border-border/60 px-5 py-3 text-[11px] leading-6 text-muted-foreground sm:px-6">
            小宇宙的公开网页只返回最新 {episodes.length} 集。更多历史单集需要登录后在小宇宙 App
            内访问，本工具不收集账号信息。
          </div>
        ) : null}
      </section>
    </>
  )
}

function EpisodeRow({ episode, index }: { episode: Episode; index: number }) {
  const paid = isPaid(episode)

  return (
    <div className="group flex items-center gap-3 border-b border-border/50 px-2 py-3 transition-colors last:border-b-0 hover:bg-muted/50 sm:px-3">
      <span className="w-7 shrink-0 text-center font-mono text-[11px] tabular-nums text-muted-foreground/70">
        {String(index).padStart(2, '0')}
      </span>

      <Cover
        src={episode.imageUrl}
        alt=""
        className="size-12 shrink-0 rounded-xl"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium sm:text-[15px]">
          {episode.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {episode.pubDate ? <span>{formatDate(episode.pubDate)}</span> : null}
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" />
            {formatDuration(episode.duration)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Play className="size-3" />
            {formatCount(episode.playCount)}
          </span>
          {paid ? (
            <span className="text-destructive">付费 / 受限</span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity sm:opacity-60 sm:group-hover:opacity-100">
        {paid || !episode.audioUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled
            title="付费或受限内容"
            aria-label="付费内容不可下载"
            className="size-10 rounded-xl sm:size-8"
          >
            <Download className="size-4" />
          </Button>
        ) : (
          <Button
            asChild
            variant="ghost"
            size="icon"
            title="下载音频"
            className="size-10 rounded-xl sm:size-8"
          >
            <DownloadLink
              href={downloadHref(episode.audioUrl, audioFilename(episode))}
              aria-label={`下载 ${episode.title} 的音频`}
            >
              <Download className="size-4" />
            </DownloadLink>
          </Button>
        )}

        {episode.imageUrl ? (
          <Button
            asChild
            variant="ghost"
            size="icon"
            title="下载单集封面"
            className="size-10 rounded-xl sm:size-8"
          >
            <DownloadLink
              href={downloadHref(
                episode.imageUrl,
                coverFilename(episode.title, episode.imageExt),
              )}
              aria-label={`下载 ${episode.title} 的封面`}
            >
              <ImageDown className="size-4" />
            </DownloadLink>
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function LoadingPanel() {
  return (
    <div className="mt-8 animate-rise rounded-[1.6rem] bg-card p-5 sm:p-7">
      <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)]">
        <Skeleton className="aspect-square w-full max-w-[200px] rounded-2xl" />
        <div className="space-y-4 py-2">
          <Skeleton className="h-5 w-36 rounded-full" />
          <Skeleton className="h-9 w-4/5" />
          <Skeleton className="h-9 w-3/5" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2 pt-3">
            <Skeleton className="h-10 w-28 rounded-xl" />
            <Skeleton className="h-10 w-28 rounded-xl" />
          </div>
        </div>
      </div>
      <p className="mt-5 inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        正在读取小宇宙公开页面并整理下载信息…
      </p>
    </div>
  )
}

function HowItWorks() {
  const steps = [
    {
      title: '粘贴链接',
      description:
        '复制小宇宙的单集或播客页面地址，也可以直接输入 24 位 ID。',
    },
    {
      title: '解析公开数据',
      description:
        '服务端读取页面内嵌数据，提取音频直链、原图封面、简介与发布时间。',
    },
    {
      title: '带走文件',
      description:
        '下载经由本站转发，自动生成“单集 - 播客”文件名，绕开跨域限制。',
    },
  ]

  return (
    <section id="how" className="mt-16 scroll-mt-28 sm:mt-20">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            <span className="size-1 rounded-full bg-brand" />
            How it works
          </p>
          <h2 className="mt-2 text-2xl font-medium tracking-[-0.025em] sm:text-3xl">
            三步，把声音带走。
          </h2>
        </div>
        <a
          href="https://github.com/LGiki/cosmos-enhanced"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground no-underline transition hover:text-foreground"
        >
          灵感来自 Cosmos Enhanced
          <ExternalLink className="size-3.5" />
        </a>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step.title} className="glass-panel rounded-2xl p-5">
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
              0{index + 1}
            </span>
            <h3 className="mt-3 text-[15px] font-medium">{step.title}</h3>
            <p className="mt-1.5 text-[13px] leading-6 text-muted-foreground">
              {step.description}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11px] leading-6 text-muted-foreground">
        * 链接解析仅使用小宇宙网页公开返回的数据；播客页目前公开最新 15
        集。音频与封面版权归创作者所有，请仅用于个人备份，不要二次传播或商用。
      </p>
    </section>
  )
}
