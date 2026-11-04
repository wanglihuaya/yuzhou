import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
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
  Download,
  ExternalLink,
  FileText,
  HardDrive,
  Heart,
  ImageDown,
  Link2,
  ListMusic,
  ListPlus,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Play,
  Search,
  User,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Cover } from '@/components/Cover'
import { HotList } from '@/components/HotList'
import { useLibrary } from '@/components/LibraryProvider'
import {
  useAudioPlayer,
  type PlaybackTrack,
} from '@/components/AudioPlayer'
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
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  copyText,
  downloadFromCdn,
  downloadText,
  registerServiceWorker,
  sleep,
} from '@/lib/browser'
import { type LibraryItem } from '@/lib/library'
import {
  getDownloadProgress,
  subscribeDownloadProgress,
  type DownloadProgressState,
} from '@/lib/download-progress'
import {
  formatBytes,
  formatCount,
  formatDate,
  formatDuration,
  htmlToText,
} from '@/lib/format'
import { sanitizeHtml } from '@/lib/sanitize'
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
  type CommentReply,
  type Episode,
  type EpisodeComment,
  type Podcast,
  type ResolvedData,
} from '@/lib/xiaoyuzhou'
import { cn } from '@/lib/utils'

const BASE_TITLE = '宇宙备份 · 小宇宙音频播放与下载'

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

function recentlyResolved(data: ResolvedData): LibraryItem {
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

/** Favorites always point at the show, never at a single episode. */
function podcastLibraryItem(
  podcast: Pick<Podcast, 'pid' | 'title' | 'author' | 'imageUrl'>,
): LibraryItem {
  return {
    url: `https://www.xiaoyuzhoufm.com/podcast/${podcast.pid}`,
    title: podcast.title,
    subtitle: podcast.author,
    kind: 'podcast',
    image: podcast.imageUrl,
    at: Date.now(),
  }
}

/** The episode as the global player needs it. Paid episodes never get here. */
function playbackTrack(episode: Episode): PlaybackTrack {
  return {
    id: episode.eid,
    title: episode.title,
    podcast: episode.podcast.title,
    cover: episode.imageUrl,
    src: episode.audioUrl,
    duration: episode.duration,
  }
}

/** Downloads cannot start inside WeChat's webview; explain instead of failing. */
function guardedDownload(url: string, filename: string): void {
  if (isWeChatBrowser()) {
    signalWeChatDownloadBlocked(url)
    return
  }
  // Pull the file straight from the CDN; the proxy route is only a fallback.
  void downloadFromCdn(url, filename, downloadHref(url, filename))
}

/** An anchor download that hands over to the WeChat explanation when needed. */
function DownloadLink({
  url,
  filename,
  onClick,
  children,
  ...props
}: Omit<ComponentProps<'a'>, 'href'> & { url: string; filename: string }) {
  return (
    <a
      href={downloadHref(url, filename)}
      {...props}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) {
          return
        }
        event.preventDefault()
        guardedDownload(url, filename)
      }}
    >
      {children}
    </a>
  )
}

export function ArchiveApp({ urlParam, onUrlChange }: ArchiveAppProps) {
  const { history, addHistory } = useLibrary()
  const [input, setInput] = useState(urlParam ?? '')
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<ResolvedData | null>(null)
  const [error, setError] = useState('')
  const [batch, setBatch] = useState<'audio' | 'cover' | null>(null)
  const [inWeChat, setInWeChat] = useState(false)
  const [wechatHint, setWechatHint] = useState<WeChatHintState>({
    open: false,
  })

  const requestSeq = useRef(0)
  const lastResolved = useRef<string | null>(null)
  const resultRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const transfer = useSyncExternalStore(
    subscribeDownloadProgress,
    getDownloadProgress,
    () => null,
  )

  useEffect(() => {
    setInWeChat(isWeChatBrowser())
    registerServiceWorker()
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
        addHistory(recentlyResolved(response.data))

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
    [addHistory],
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
    if (!input.trim()) {
      inputRef.current?.focus()
      return
    }
    resolveAndTrack(input)
  }

  function clearInput() {
    setInput('')
    if (urlParam) {
      lastResolved.current = null
      onUrlChange('')
    }
    inputRef.current?.focus()
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
        const filename = audioFilename(episode)
        await downloadFromCdn(
          episode.audioUrl,
          filename,
          downloadHref(episode.audioUrl, filename),
          { useFilePicker: false },
        )
        if (index < downloadable.length - 1) {
          await sleep(800)
        }
      }
      toast.success(`已下载 ${downloadable.length} 个音频`, {
        description: `${title} · 文件已保存到下载目录。`,
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
        const filename = coverFilename(episode.title, episode.imageExt)
        await downloadFromCdn(
          episode.imageUrl,
          filename,
          downloadHref(episode.imageUrl, filename),
          { useFilePicker: false },
        )
        if (index < downloadable.length - 1) {
          await sleep(800)
        }
      }
      toast.success(`已下载 ${downloadable.length} 个封面`, {
        description: `${title} · 文件已保存到下载目录。`,
      })
    } finally {
      setBatch(null)
    }
  }

  return (
    <main className="relative w-full pb-[max(3rem,env(safe-area-inset-bottom))]">
      <div className="paper-band" aria-hidden="true" />

      <div className="relative mx-auto w-full max-w-[980px] px-5 pt-8 sm:px-6 sm:pt-10">
        {inWeChat ? <WeChatNotice onCopy={() => void copyPageLink()} /> : null}

        <section className="animate-rise">
          <div className="mx-auto max-w-[640px] text-center">
            <p className="inline-flex items-center gap-1.5 text-[12px] font-medium text-brand">
              <span className="size-1.5 rounded-full bg-brand" />
              小宇宙 · 公开页面解析 · 无需登录
            </p>

            <h1 className="mt-3 font-heading text-[30px] leading-[1.3] font-bold tracking-[-0.02em] text-balance text-foreground sm:text-[40px] sm:leading-[1.25]">
              <span className="block">把喜欢的声音，</span>
              <span className="block">留在自己手里。</span>
            </h1>

            <p className="mx-auto mt-4 max-w-[520px] text-[14px] leading-7 text-muted-foreground sm:text-[15px]">
              粘贴小宇宙的单集或播客链接，即可在线试听，也能解析音频、原图封面与节目简介。
              想听的可以先加入待播，需要留存时直接下载，文件由浏览器保存，文件名已经替你整理好。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mx-auto mt-8 max-w-[600px]">
            <div className="flex items-stretch gap-1.5 rounded-[6px] border border-input bg-card p-1.5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-[border-color,box-shadow] focus-within:border-brand/70 focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand)_10%,transparent)]">
              <Link2
                className="ml-2.5 size-[17px] shrink-0 self-center text-muted-foreground"
                aria-hidden="true"
              />
              <div className="relative min-w-0 flex-1">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape' && input) {
                      event.preventDefault()
                      clearInput()
                    }
                  }}
                  placeholder="粘贴单集 / 播客链接，或 24 位 ID"
                  aria-label="小宇宙链接"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="url"
                  className="h-11 rounded-none border-0 bg-transparent pr-9 pl-0 text-[15px] shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-[15px]"
                />
                {input ? (
                  <button
                    type="button"
                    onClick={clearInput}
                    aria-label="清空输入"
                    title="清空输入"
                    className="absolute top-1/2 right-0 grid size-8 -translate-y-1/2 place-items-center rounded-[4px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
              <Button
                type="submit"
                disabled={status === 'loading'}
                className="h-11 shrink-0 gap-1.5 rounded-[4px] px-4 text-[14px] font-medium sm:px-5"
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    解析中
                  </>
                ) : (
                  <>
                    <Search className="size-4" />
                    <span className="sm:hidden">解析</span>
                    <span className="hidden sm:inline">解析链接</span>
                  </>
                )}
              </Button>
            </div>
          </form>

          {history.length > 0 ? (
            <div className="mx-auto mt-7 flex max-w-[640px] flex-wrap items-center justify-center gap-2">
              <span className="text-[11px] text-muted-foreground">最近</span>
              {history.slice(0, 6).map((item) => (
                <button
                  key={item.url}
                  type="button"
                  onClick={() => resolveAndTrack(item.url)}
                  className="flex max-w-full items-center gap-2 rounded-[4px] border border-border bg-card py-1 pr-2.5 pl-1 text-[12px] text-muted-foreground transition-colors hover:border-input hover:text-foreground"
                >
                  <Cover
                    src={item.image}
                    alt=""
                    className="size-6 rounded-[3px]"
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

        {!urlParam && status === 'idle' ? (
          <HotList onOpen={(url) => resolveAndTrack(url)} />
        ) : null}

        <div ref={resultRef} className="scroll-mt-24">
          {status === 'loading' ? <LoadingPanel /> : null}

          {status === 'error' ? (
            <div
              role="alert"
              className="mx-auto mt-10 max-w-[640px] animate-rise rounded-[6px] border border-destructive/20 bg-destructive/[0.035] p-5 sm:p-6"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-[14px] font-semibold">没能解析这个链接</h2>
                  <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
                    {error}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => void runResolve(input, { scroll: true })}
                      className="h-9 rounded-[4px] px-3.5 text-[13px]"
                    >
                      重试
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {status === 'ready' && result ? (
            <div className="mt-12 animate-rise sm:mt-14">
              {result.kind === 'episode' ? (
                <>
                  <EpisodeResult episode={result.episode} />
                  <EpisodeShownotes shownotes={result.episode.shownotes} />
                  <EpisodeComments
                    comments={result.comments}
                    total={result.episode.commentCount}
                    episodeId={result.episode.eid}
                  />
                </>
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

        <TransferPanel transfer={transfer} />
      </div>
    </main>
  )
}

function TransferPanel({ transfer }: { transfer: DownloadProgressState | null }) {
  const { track } = useAudioPlayer()

  if (!transfer) {
    return null
  }

  const percent =
    transfer.total && transfer.total > 0
      ? Math.min(100, Math.round((transfer.received / transfer.total) * 100))
      : null

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed inset-x-4 z-50 rounded-[6px] border border-border bg-popover p-4 shadow-[0_12px_36px_-12px_rgb(0_0_0/0.22)] sm:inset-x-auto sm:right-6 sm:w-[320px]',
        track
          ? 'bottom-[calc(6rem+env(safe-area-inset-bottom))]'
          : 'bottom-[max(1rem,env(safe-area-inset-bottom))]',
      )}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-muted text-brand">
          {transfer.done ? (
            <Check className="size-4" />
          ) : (
            <Download className="size-4 animate-pulse" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{transfer.label}</p>
          <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
            {transfer.done
              ? '已保存'
              : `${formatBytes(transfer.received)}${
                  transfer.total ? ` / ${formatBytes(transfer.total)}` : ''
                }`}
          </p>
        </div>
        {percent !== null ? (
          <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
            {percent}%
          </span>
        ) : null}
      </div>
      <Progress value={percent ?? 0} className="mt-3 h-1 rounded-[1px]" />
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
        {transfer.done
          ? '下载完成。'
          : '正在从 CDN 直连下载，完成后文件才会写入磁盘。'}
      </p>
    </div>
  )
}

function WeChatNotice({ onCopy }: { onCopy: () => void }) {
  return (
    <div className="mb-6 flex flex-col gap-2.5 rounded-[6px] border-l-2 border-brand bg-brand-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold">微信内无法直接保存文件</p>
        <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">
          点右上角 ···，选择「在浏览器打开」，再回到本页下载。
        </p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="shrink-0 self-start rounded-[4px] bg-background/80 px-3 py-1.5 text-[12px] font-medium text-brand transition-colors hover:bg-background sm:self-auto"
      >
        复制本页链接
      </button>
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
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-[18px] font-bold tracking-tight">
            微信内不能直接下载
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-6">
            微信内置浏览器会拦截文件下载。把页面交给系统浏览器，文件就能正常保存。
          </DialogDescription>
        </DialogHeader>

        <ol className="grid gap-3">
          {steps.map((step, index) => (
            <li key={step} className="flex items-start gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-[3px] bg-brand-muted text-[11px] font-medium text-brand">
                {index + 1}
              </span>
              <span className="pt-0.5 text-[13px] leading-5 text-foreground/90">
                {step}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            onClick={onCopyPage}
            className="h-10 flex-1 rounded-[4px] text-[13px]"
          >
            <Copy className="size-4" />
            复制本页链接
          </Button>
          {state.href ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onCopyDownload(state.href!)}
              className="h-10 flex-1 rounded-[4px] text-[13px]"
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

function MetaItem({
  icon,
  children,
}: {
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {icon}
      {children}
    </span>
  )
}

function EpisodeResult({ episode }: { episode: Episode }) {
  const player = useAudioPlayer()
  const { favorites, toggleFavorite } = useLibrary()
  const description = episode.shownotes
    ? htmlToText(episode.shownotes)
    : episode.description
  const paid = isPaid(episode)
  const playable = !paid && Boolean(episode.audioUrl)
  const current = player.isCurrent(episode.eid)
  const isPlaying = current && player.playing
  const audioName = episode.audioUrl ? audioFilename(episode) : ''
  const originalUrl = `https://www.xiaoyuzhoufm.com/episode/${episode.eid}`
  const favoriteUrl = `https://www.xiaoyuzhoufm.com/podcast/${episode.podcast.pid}`
  const favorited = favorites.some((item) => item.url === favoriteUrl)

  function handleToggleFavorite() {
    const next = toggleFavorite(podcastLibraryItem(episode.podcast))
    toast.success(next ? '已收藏播客' : '已取消收藏', {
      description: episode.podcast.title,
    })
  }

  function handleEnqueue() {
    const added = player.enqueue(playbackTrack(episode))
    if (added > 0) {
      toast.success('已加入待播列表', { description: episode.title })
    } else {
      toast('已在待播列表中', { description: episode.title })
    }
  }

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
    <article className="mx-auto max-w-[640px] text-center">
      <div className="cover-frame mx-auto aspect-square w-[132px] sm:w-[148px]">
        <Cover
          src={episode.imageUrl}
          alt={`${episode.title} 封面`}
          className="h-full w-full"
        />
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        原图封面 · {episode.imageExt.toUpperCase()}
      </p>

      <h2 className="mx-auto mt-3 max-w-[560px] font-heading text-[22px] leading-[1.4] font-bold tracking-[-0.01em] text-balance text-foreground sm:text-[26px]">
        {episode.title}
      </h2>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <a
          href={`https://www.xiaoyuzhoufm.com/podcast/${episode.podcast.pid}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-brand no-underline transition-colors hover:text-brand/75"
        >
          <Cover
            src={episode.podcast.imageUrl}
            alt=""
            className="size-[18px] shrink-0 rounded-full"
          />
          <span className="max-w-60 truncate">{episode.podcast.title}</span>
        </a>
        {episode.podcast.author ? (
          <span className="text-[12px] text-muted-foreground">
            {episode.podcast.author}
          </span>
        ) : null}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5 text-[11px] text-muted-foreground">
        <MetaItem icon={<Clock className="size-3" />}>
          {formatDuration(episode.duration)}
        </MetaItem>
        {episode.pubDate ? (
          <MetaItem icon={<Calendar className="size-3" />}>
            {formatDate(episode.pubDate)}
          </MetaItem>
        ) : null}
        <MetaItem icon={<Play className="size-3" />}>
          {formatCount(episode.playCount)}
        </MetaItem>
        <MetaItem icon={<MessageCircle className="size-3" />}>
          {formatCount(episode.commentCount)}
        </MetaItem>
        <MetaItem icon={<HardDrive className="size-3" />}>
          {episode.audioSize > 0 ? `${formatBytes(episode.audioSize)} · ` : ''}
          {episode.audioExt.toUpperCase()}
        </MetaItem>
      </div>

      <div className="mt-2.5 flex items-center justify-center">
        {paid ? (
          <span className="rounded-[3px] bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
            付费 / 受限
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-[3px] bg-brand-muted px-2 py-0.5 text-[11px] font-medium text-brand">
            <Check className="size-3" />
            {playable ? '可在线播放 · 可下载' : '可公开下载'}
          </span>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        {playable ? (
          <Button
            onClick={() =>
              current ? player.toggle() : player.play(playbackTrack(episode))
            }
            aria-label={isPlaying ? `暂停 ${episode.title}` : `播放 ${episode.title}`}
            className="h-10 rounded-[4px] px-3 text-[13px] sm:px-4"
          >
            {current && player.loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isPlaying ? (
              <Pause className="size-4 fill-current" />
            ) : (
              <Play className="size-4 fill-current" />
            )}
            {isPlaying ? '暂停' : '播放'}
          </Button>
        ) : null}

        <Button
          type="button"
          variant="outline"
          onClick={handleToggleFavorite}
          aria-pressed={favorited}
          className="h-10 rounded-[4px] px-3 text-[13px] sm:px-4"
        >
          <Heart
            className={cn(
              'size-4',
              favorited && 'fill-current text-brand',
            )}
          />
          {favorited ? '已收藏' : '收藏播客'}
        </Button>

        {playable ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleEnqueue}
            className="h-10 rounded-[4px] px-3 text-[13px] sm:px-4"
          >
            <ListPlus className="size-4" />
            加入待播列表
          </Button>
        ) : null}

        {paid ? (
          <Button disabled className="h-10 rounded-[4px] px-3 text-[13px] sm:px-4">
            <Download className="size-4" /> 付费内容不可下载
          </Button>
        ) : episode.audioUrl ? (
          <Button
            asChild
            variant={playable ? 'outline' : 'default'}
            className="h-10 rounded-[4px] px-3 text-[13px] sm:px-4"
          >
            <DownloadLink url={episode.audioUrl} filename={audioName}>
              <Download className="size-4" /> 下载音频
            </DownloadLink>
          </Button>
        ) : (
          <Button disabled className="h-10 rounded-[4px] px-3 text-[13px] sm:px-4">
            <Download className="size-4" /> 暂无音频
          </Button>
        )}

        <Button
          asChild
          variant="outline"
          className="h-10 rounded-[4px] px-3 text-[13px] sm:px-4"
        >
          <DownloadLink
            url={episode.imageUrl}
            filename={coverFilename(episode.title, episode.imageExt)}
          >
            <ImageDown className="size-4" /> 下载封面
          </DownloadLink>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="h-10 rounded-[4px] px-3 text-[13px]"
              aria-label="更多操作"
            >
              <MoreHorizontal className="size-4" />
              <span className="hidden sm:inline">更多</span>
              <ChevronDown className="hidden size-3 text-muted-foreground sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-52">
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
    </article>
  )
}

function SectionHeading({
  title,
  aside,
}: {
  title: string
  aside?: ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="font-heading text-[15px] font-bold tracking-[-0.01em] text-foreground">
        {title}
      </h3>
      {aside}
    </div>
  )
}

function EpisodeShownotes({ shownotes }: { shownotes: string }) {
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const html = sanitizeHtml(shownotes)

  useEffect(() => {
    const element = contentRef.current
    if (!element) {
      return
    }

    const measure = () => setOverflowing(element.scrollHeight > 380)
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [html])

  if (!html) {
    return null
  }

  return (
    <section className="mx-auto mt-10 max-w-[640px] border-t border-border pt-6">
      <SectionHeading
        title="节目简介"
        aside={
          <span className="text-[10px] tracking-[0.18em] text-muted-foreground/70 uppercase">
            Show notes
          </span>
        }
      />
      <div
        ref={contentRef}
        className={cn(
          'show-notes mt-3',
          overflowing && !expanded && 'notes-fold',
        )}
        data-expanded={expanded}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {overflowing ? (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="inline-flex items-center gap-1 rounded-[3px] bg-brand-muted px-3 py-1.5 text-[12px] font-medium text-brand transition-colors hover:bg-brand/15"
          >
            {expanded ? '收起 Show Notes' : '展开 Show Notes'}
            <ChevronDown
              className={cn(
                'size-3.5 transition-transform',
                expanded && 'rotate-180',
              )}
            />
          </button>
        </div>
      ) : null}
    </section>
  )
}

function CommentReplyItem({ reply }: { reply: CommentReply }) {
  return (
    <div className="flex gap-2.5">
      <Cover
        src={reply.author.avatar}
        alt=""
        className="mt-0.5 size-6 shrink-0 rounded-full"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="text-[12px] font-medium text-foreground/75">
            {reply.author.nickname || '匿名听友'}
          </span>
          {reply.replyTo ? <span>回复 @{reply.replyTo}</span> : null}
          {reply.createdAt ? (
            <time dateTime={reply.createdAt}>{formatDate(reply.createdAt)}</time>
          ) : null}
        </div>
        <p className="mt-1 text-[12.5px] leading-5 break-words whitespace-pre-wrap text-foreground/85">
          {reply.text}
        </p>
        {reply.likeCount > 0 ? (
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Heart className="size-3" />
            {formatCount(reply.likeCount)}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function CommentItem({ comment }: { comment: EpisodeComment }) {
  const [expanded, setExpanded] = useState(false)
  const replies = expanded ? comment.replies : comment.replies.slice(0, 2)
  const hiddenReplies = comment.replies.length - replies.length
  const isPodcaster = comment.authorAssociation === 'PODCASTER'

  return (
    <li className="border-t border-border py-5 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex gap-3">
        <Cover
          src={comment.author.avatar}
          alt=""
          className="mt-0.5 size-8 shrink-0 rounded-full"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13px] font-medium text-foreground/70">
              {comment.author.nickname || '匿名听友'}
            </span>
            {isPodcaster ? (
              <Badge
                variant="secondary"
                className="h-[18px] rounded-[3px] px-1.5 text-[10px]"
              >
                主播
              </Badge>
            ) : null}
            {comment.pinned ? (
              <Badge
                variant="outline"
                className="h-[18px] rounded-[3px] px-1.5 text-[10px]"
              >
                置顶
              </Badge>
            ) : null}
            {comment.createdAt ? (
              <time
                dateTime={comment.createdAt}
                className="text-[11px] text-muted-foreground"
              >
                {formatDate(comment.createdAt)}
              </time>
            ) : null}
            {comment.author.ipLoc ? (
              <span className="text-[11px] text-muted-foreground/60">
                {comment.author.ipLoc}
              </span>
            ) : null}
          </div>

          <p className="mt-1.5 text-[14px] leading-[1.8] break-words whitespace-pre-wrap text-foreground">
            {comment.text}
          </p>

          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Heart className="size-3.5" />
              {formatCount(comment.likeCount)}
            </span>
            {comment.replyCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="size-3.5" />
                {formatCount(comment.replyCount)} 条回复
              </span>
            ) : null}
          </div>

          {comment.replies.length > 0 ? (
            <div className="mt-3 space-y-3 rounded-[4px] bg-muted px-3 py-3">
              {replies.map((reply) => (
                <CommentReplyItem key={reply.id} reply={reply} />
              ))}
              {hiddenReplies > 0 ? (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-brand transition-colors hover:underline"
                >
                  <ChevronDown className="size-3" />
                  展开其余 {hiddenReplies} 条回复
                </button>
              ) : null}
              {expanded && comment.replies.length > 2 ? (
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-brand transition-colors hover:underline"
                >
                  <ChevronDown className="size-3 rotate-180" />
                  收起回复
                </button>
              ) : null}
              {comment.replyCount > comment.replies.length ? (
                <p className="text-[11px] text-muted-foreground/70">
                  共 {formatCount(comment.replyCount)} 条回复，公开页面仅展示其中{' '}
                  {comment.replies.length} 条。
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  )
}

function EpisodeComments({
  comments,
  total,
  episodeId,
}: {
  comments: EpisodeComment[]
  total: number
  episodeId: string
}) {
  if (comments.length === 0) {
    return null
  }

  const shownTotal = Math.max(total, comments.length)

  return (
    <section className="mx-auto mt-10 max-w-[640px] border-t border-border pt-6">
      <SectionHeading
        title="评论"
        aside={
          <span className="text-[11px] text-muted-foreground">
            {formatCount(shownTotal)} 条
          </span>
        }
      />
      <ul className="mt-4">
        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </ul>
      <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-4 text-[11px] text-muted-foreground">
        <span>
          公开页面仅展示前 {comments.length} 条评论
          {shownTotal > comments.length
            ? `，共 ${formatCount(shownTotal)} 条。`
            : '。'}
        </span>
        <a
          href={`https://www.xiaoyuzhoufm.com/episode/${episodeId}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-brand no-underline hover:underline"
        >
          在小宇宙查看全部
          <ExternalLink className="size-3" />
        </a>
      </p>
    </section>
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
  const { favorites, toggleFavorite } = useLibrary()
  const player = useAudioPlayer()
  const originalUrl = `https://www.xiaoyuzhoufm.com/podcast/${podcast.pid}`
  const favorited = favorites.some((item) => item.url === originalUrl)
  const downloadableCount = episodes.filter(
    (episode) => episode.audioUrl && !isPaid(episode),
  ).length
  const playableTracks = episodes
    .filter((episode) => !isPaid(episode) && Boolean(episode.audioUrl))
    .map(playbackTrack)

  function handleToggleFavorite() {
    const next = toggleFavorite(podcastLibraryItem(podcast))
    toast.success(next ? '已收藏播客' : '已取消收藏', {
      description: podcast.title,
    })
  }

  function handleAddAllToQueue() {
    const added = player.enqueue(playableTracks)
    if (added > 0) {
      toast.success(`已加入播放列表（${added} 集）`, {
        description: podcast.title,
      })
    } else {
      toast('这些单集已在播放列表中', { description: podcast.title })
    }
  }

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
      <article className="mx-auto max-w-[640px] text-center">
        <div className="cover-frame relative mx-auto aspect-square w-[148px] sm:w-[168px]">
          <Cover
            src={podcast.imageUrl}
            alt={`${podcast.title} 封面`}
            className="h-full w-full"
          />
          <span className="absolute right-2 bottom-2 rounded-[2px] bg-brand px-1.5 py-0.5 text-[10px] leading-4 font-medium text-brand-foreground shadow-sm">
            {podcast.episodeCount} 集
          </span>
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">
          播客封面原图 · {podcast.imageExt.toUpperCase()}
        </p>

        <h2 className="mx-auto mt-3 max-w-[560px] font-heading text-[24px] leading-[1.35] font-bold tracking-[-0.01em] text-balance text-foreground sm:text-[30px]">
          {podcast.title}
        </h2>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[12px] text-muted-foreground">
          {podcast.author ? (
            <MetaItem icon={<User className="size-3.5" />}>
              {podcast.author}
            </MetaItem>
          ) : null}
          <MetaItem icon={<ListMusic className="size-3.5" />}>
            {formatCount(podcast.subscriptionCount)} 人订阅
          </MetaItem>
          {podcast.latestEpisodePubDate ? (
            <MetaItem icon={<Calendar className="size-3.5" />}>
              {formatDate(podcast.latestEpisodePubDate)} 更新
            </MetaItem>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            onClick={onDownloadAllAudio}
            disabled={batch !== null || downloadableCount === 0}
            className="h-10 rounded-[4px] px-4 text-[13px]"
          >
            {batch === 'audio' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            下载全部音频（{downloadableCount}）
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleToggleFavorite}
            aria-pressed={favorited}
            className="h-10 rounded-[4px] px-4 text-[13px]"
          >
            <Heart
              className={cn(
                'size-4',
                favorited && 'fill-current text-brand',
              )}
            />
            {favorited ? '已收藏' : '收藏播客'}
          </Button>

          <Button
            asChild
            variant="outline"
            className="h-10 rounded-[4px] px-4 text-[13px]"
          >
            <DownloadLink
              url={podcast.imageUrl}
              filename={coverFilename(podcast.title, podcast.imageExt)}
            >
              <ImageDown className="size-4" /> 播客封面
            </DownloadLink>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-10 rounded-[4px] px-3 text-[13px]"
                aria-label="更多操作"
              >
                <MoreHorizontal className="size-4" />
                <span className="hidden sm:inline">更多</span>
                <ChevronDown className="hidden size-3 text-muted-foreground sm:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-56">
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
                            person.avatar!.url,
                            avatarFilename(person.nickname, person.avatar!.ext),
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
                onClick={() => window.open(originalUrl, '_blank', 'noopener')}
              >
                <ExternalLink className="size-4" /> 打开小宇宙原页
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {podcast.description ? (
          <details className="group mt-6 border-t border-border pt-4 text-left">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <FileText className="size-3.5" />
                播客简介
              </span>
              <ChevronDown className="size-4 transition group-open:rotate-180" />
            </summary>
            <div className="mt-3 max-h-60 overflow-y-auto pr-2 text-[13px] leading-[1.8] whitespace-pre-wrap text-muted-foreground">
              {podcast.description}
            </div>
          </details>
        ) : null}
      </article>

      <section className="mx-auto mt-10 max-w-[700px] border-t border-border pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="font-heading text-[18px] font-bold tracking-[-0.01em]">
              最新单集
            </h3>
            <p className="mt-1 text-[12px] text-muted-foreground">
              公开页面可读取的最新 {episodes.length} 集，逐集下载或批量带走。
            </p>
          </div>
          {hasMore ? (
            <span className="text-[11px] text-muted-foreground">
              共 {podcast.episodeCount} 集 · 展示最新 {episodes.length} 集
            </span>
          ) : null}
        </div>

        <div className="mt-2">
          {episodes.map((episode, index) => (
            <EpisodeRow
              key={episode.eid || `${episode.title}-${index}`}
              episode={episode}
            />
          ))}
          {episodes.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-muted-foreground">
              这个播客暂时没有公开单集。
            </p>
          ) : null}
        </div>

        {playableTracks.length > 0 ? (
          <div className="mt-3 flex justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={handleAddAllToQueue}
              className="h-9 rounded-[4px] px-3.5 text-[13px]"
            >
              <ListPlus className="size-4" />
              加入播放列表（{playableTracks.length}）
            </Button>
          </div>
        ) : null}

        {hasMore ? (
          <div className="border-t border-border pt-3 text-[11px] leading-6 text-muted-foreground">
            小宇宙的公开网页只返回最新 {episodes.length} 集。更多历史单集需要登录后在小宇宙 App
            内访问，本工具不收集账号信息。
          </div>
        ) : null}
      </section>
    </>
  )
}

function EpisodeRow({ episode }: { episode: Episode }) {
  const player = useAudioPlayer()
  const paid = isPaid(episode)
  const playable = !paid && Boolean(episode.audioUrl)
  const current = player.isCurrent(episode.eid)
  const isPlaying = current && player.playing
  const blurb = episode.description ? htmlToText(episode.description).trim() : ''

  function handleEnqueue() {
    const added = player.enqueue(playbackTrack(episode))
    if (added > 0) {
      toast.success('已加入待播列表', { description: episode.title })
    } else {
      toast('已在待播列表中', { description: episode.title })
    }
  }

  return (
    <div className="group flex gap-3.5 border-b border-border py-5 last:border-b-0 sm:gap-4">
      <Cover
        src={episode.imageUrl}
        alt=""
        className="size-14 shrink-0 rounded-[4px]"
      />

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[15px] leading-[1.5] font-medium text-foreground">
          {episode.title}
        </p>
        {blurb ? (
          <p className="mt-1 line-clamp-2 text-[13px] leading-[1.65] text-muted-foreground">
            {blurb}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" />
            {formatDuration(episode.duration)}
          </span>
          {episode.pubDate ? <span>{formatDate(episode.pubDate)}</span> : null}
          <span className="inline-flex items-center gap-1">
            <Play className="size-3" />
            {formatCount(episode.playCount)}
          </span>
          {current ? (
            <span className="inline-flex items-center gap-1 font-medium text-brand">
              <span
                className={cn(
                  'size-1.5 rounded-full bg-brand',
                  isPlaying && 'animate-pulse',
                )}
              />
              {isPlaying ? '播放中' : '已暂停'}
            </span>
          ) : null}
          {paid ? (
            <span className="font-medium text-destructive">付费 / 受限</span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 self-center">
        {playable ? (
          <button
            type="button"
            onClick={() =>
              current ? player.toggle() : player.play(playbackTrack(episode))
            }
            aria-label={
              isPlaying ? `暂停 ${episode.title}` : `播放 ${episode.title}`
            }
            title={isPlaying ? '暂停' : '播放'}
            className={cn(
              'grid size-9 place-items-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none',
              current
                ? 'border-brand bg-brand text-brand-foreground hover:bg-brand/90'
                : 'border-brand/35 text-brand hover:border-brand hover:bg-brand hover:text-brand-foreground',
            )}
          >
            {current && player.loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isPlaying ? (
              <Pause className="size-4 fill-current" />
            ) : (
              <Play className="size-4 fill-current" />
            )}
          </button>
        ) : (
          <span
            className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground/35"
            title="付费或受限内容"
            aria-label="付费内容不可播放或下载"
          >
            <Download className="size-4" />
          </span>
        )}

        {playable ? (
          <button
            type="button"
            onClick={handleEnqueue}
            aria-label={`将 ${episode.title} 加入待播列表`}
            title="加入待播列表"
            className="hidden size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none sm:grid"
          >
            <ListPlus className="size-4" />
          </button>
        ) : null}

        {!paid && episode.audioUrl ? (
          <DownloadLink
            url={episode.audioUrl}
            filename={audioFilename(episode)}
            aria-label={`下载 ${episode.title} 的音频`}
            title="下载音频"
            className="hidden size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:grid"
          >
            <Download className="size-4" />
          </DownloadLink>
        ) : null}

        {episode.imageUrl ? (
          <DownloadLink
            url={episode.imageUrl}
            filename={coverFilename(episode.title, episode.imageExt)}
            aria-label={`下载 ${episode.title} 的封面`}
            title="下载单集封面"
            className="hidden size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:grid"
          >
            <ImageDown className="size-4" />
          </DownloadLink>
        ) : null}

        {playable || (!paid && episode.audioUrl) || episode.imageUrl ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`${episode.title} 的更多操作`}
                title="更多操作"
                className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none sm:hidden"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {playable ? (
                <DropdownMenuItem onClick={handleEnqueue}>
                  <ListPlus className="size-4" /> 加入待播列表
                </DropdownMenuItem>
              ) : null}
              {!paid && episode.audioUrl ? (
                <DropdownMenuItem
                  onClick={() =>
                    guardedDownload(episode.audioUrl, audioFilename(episode))
                  }
                >
                  <Download className="size-4" /> 下载音频
                </DropdownMenuItem>
              ) : null}
              {episode.imageUrl ? (
                <DropdownMenuItem
                  onClick={() =>
                    guardedDownload(
                      episode.imageUrl,
                      coverFilename(episode.title, episode.imageExt),
                    )
                  }
                >
                  <ImageDown className="size-4" /> 下载封面
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  )
}

function LoadingPanel() {
  return (
    <div className="mx-auto mt-12 max-w-[640px] animate-rise sm:mt-14">
      <div className="flex flex-col items-center">
        <Skeleton className="aspect-square w-[132px] rounded-[6px] sm:w-[148px]" />
        <Skeleton className="mt-5 h-3 w-24 rounded-[2px]" />
        <Skeleton className="mt-4 h-5 w-4/5 rounded-[2px]" />
        <Skeleton className="mt-2 h-5 w-3/5 rounded-[2px]" />
        <Skeleton className="mt-4 h-3 w-1/2 rounded-[2px]" />
        <div className="mt-6 flex gap-2">
          <Skeleton className="h-10 w-24 rounded-[4px]" />
          <Skeleton className="h-10 w-24 rounded-[4px]" />
        </div>
      </div>
      <div className="mt-10 space-y-3 border-t border-border pt-6">
        <Skeleton className="h-3.5 w-full rounded-[2px]" />
        <Skeleton className="h-3.5 w-[92%] rounded-[2px]" />
        <Skeleton className="h-3.5 w-[78%] rounded-[2px]" />
      </div>
      <p className="mt-6 inline-flex w-full items-center justify-center gap-2 text-[12px] text-muted-foreground">
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
      title: '试听或带走',
      description:
        '先在网页内试听，需要时再下载。文件由浏览器直接从 CDN 保存，自动生成“单集 - 播客”文件名。',
    },
  ]

  return (
    <section id="how" className="mt-16 scroll-mt-24 border-t border-border pt-8 sm:mt-20">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-[10px] tracking-[0.2em] text-brand uppercase">
            How it works
          </p>
          <h2 className="mt-1.5 font-heading text-[20px] font-bold tracking-[-0.01em]">
            三步，把声音带走。
          </h2>
        </div>
        <a
          href="https://github.com/LGiki/cosmos-enhanced"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground no-underline transition-colors hover:text-brand"
        >
          灵感来自 Cosmos Enhanced
          <ExternalLink className="size-3" />
        </a>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-3 md:gap-8">
        {steps.map((step, index) => (
          <div
            key={step.title}
            className="border-t border-border pt-3 md:border-t-0 md:border-l md:pt-0 md:pl-5 first:md:border-l-0 first:md:pl-0"
          >
            <span className="font-heading text-[12px] font-bold text-brand">
              0{index + 1}
            </span>
            <h3 className="mt-1.5 text-[14px] font-semibold">{step.title}</h3>
            <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
              {step.description}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-6 text-[11px] leading-6 text-muted-foreground">
        * 链接解析仅使用小宇宙网页公开返回的数据；播客页目前公开最新 15
        集。音频与封面版权归创作者所有，请仅用于个人备份，不要二次传播或商用。
      </p>
    </section>
  )
}
