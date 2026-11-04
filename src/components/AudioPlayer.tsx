import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  AudioLines,
  Captions,
  List,
  Loader2,
  Moon,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  X,
} from 'lucide-react'
import { Drawer } from '@base-ui/react/drawer'
import { toast } from 'sonner'

import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface PlaybackTrack {
  /** Episode id — the same episode plays or pauses on repeat clicks. */
  id: string
  title: string
  podcast: string
  cover: string
  src: string
  /** Duration in seconds from the page data, used before the file loads. */
  duration: number
}

interface AudioPlayerContextValue {
  track: PlaybackTrack | null
  playing: boolean
  loading: boolean
  currentTime: number
  duration: number
  /** Session playlist, in display order. */
  queue: PlaybackTrack[]
  rate: number
  isCurrent: (id: string) => boolean
  play: (track: PlaybackTrack, queue?: PlaybackTrack[]) => void
  toggle: () => void
  pause: () => void
  seek: (seconds: number) => void
  skip: (delta: number) => void
  cycleRate: () => void
  clearQueue: () => void
  close: () => void
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null)

export function useAudioPlayer(): AudioPlayerContextValue {
  const value = useContext(AudioPlayerContext)
  if (!value) {
    throw new Error('useAudioPlayer must be used inside <AudioPlayerProvider>')
  }
  return value
}

function clock(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return '00:00'
  }

  const total = Math.floor(value)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')

  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

const RATES = [1, 1.25, 1.5, 2, 0.75] as const

function dedupeQueue(queue: PlaybackTrack[]): PlaybackTrack[] {
  const seen = new Set<string>()
  return queue.filter((item) => {
    if (seen.has(item.id)) {
      return false
    }
    seen.add(item.id)
    return true
  })
}

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const trackRef = useRef<PlaybackTrack | null>(null)
  const queueRef = useRef<PlaybackTrack[]>([])

  const [track, setTrack] = useState<PlaybackTrack | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [queue, setQueue] = useState<PlaybackTrack[]>([])
  const [rate, setRate] = useState(1)

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      audio.defaultPlaybackRate = rate
      audio.playbackRate = rate
    }
  }, [rate, track])

  const reportFailure = useCallback((error?: unknown) => {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return
    }
    setPlaying(false)
    setLoading(false)
    toast.error('音频暂时无法播放', {
      description: '可以直接下载后离线收听。',
    })
  }, [])

  const startPlayback = useCallback(
    (audio: HTMLAudioElement) => {
      // A finished track restarts instead of sitting at the very end.
      if (
        audio.ended ||
        (Number.isFinite(audio.duration) &&
          audio.duration > 0 &&
          audio.currentTime >= audio.duration)
      ) {
        audio.currentTime = 0
        setCurrentTime(0)
      }

      setLoading(true)
      const attempt = audio.play()
      if (attempt) {
        attempt.catch((error) => reportFailure(error))
      }
    },
    [reportFailure],
  )

  const play = useCallback(
    (next: PlaybackTrack, nextQueue?: PlaybackTrack[]) => {
      const audio = audioRef.current
      if (!audio) {
        return
      }

      if (nextQueue) {
        const merged = dedupeQueue(
          nextQueue.some((item) => item.id === next.id)
            ? nextQueue
            : [next, ...nextQueue],
        )
        setQueue(merged)
      } else {
        setQueue((current) =>
          current.some((item) => item.id === next.id)
            ? current
            : [...current, next],
        )
      }

      if (trackRef.current?.id !== next.id) {
        trackRef.current = next
        setTrack(next)
        setCurrentTime(0)
        setDuration(next.duration || 0)
        audio.src = next.src
        audio.load()
        audio.playbackRate = rate
      }

      startPlayback(audio)
    },
    [rate, startPlayback],
  )

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !trackRef.current) {
      return
    }

    if (audio.paused) {
      startPlayback(audio)
    } else {
      audio.pause()
    }
  }, [startPlayback])

  const pause = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    const known =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : (trackRef.current?.duration ?? 0)
    const next = Math.min(Math.max(seconds, 0), known || seconds)

    try {
      audio.currentTime = next
      setCurrentTime(next)
    } catch {
      // Seeking before metadata is ready; the browser will catch up.
    }
  }, [])

  const skip = useCallback(
    (delta: number) => {
      const audio = audioRef.current
      if (!audio) {
        return
      }
      seek(audio.currentTime + delta)
    },
    [seek],
  )

  const cycleRate = useCallback(() => {
    setRate((current) => {
      const index = RATES.indexOf(current as (typeof RATES)[number])
      return RATES[(index + 1) % RATES.length]
    })
  }, [])

  const clearQueue = useCallback(() => {
    const current = trackRef.current
    setQueue(current ? [current] : [])
  }, [])

  const close = useCallback(() => {
    const audio = audioRef.current
    trackRef.current = null
    queueRef.current = []

    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }

    setTrack(null)
    setQueue([])
    setPlaying(false)
    setLoading(false)
    setCurrentTime(0)
    setDuration(0)
    try {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null
        navigator.mediaSession.playbackState = 'none'
      }
    } catch {
      // Media Session is optional.
    }
  }, [])

  // A detached <audio> can keep playing if the provider ever unmounts.
  useEffect(() => {
    return () => {
      audioRef.current?.pause()
    }
  }, [])

  // What the lock screen and hardware media keys show while a track plays.
  useEffect(() => {
    if (!track || typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return
    }

    const session = navigator.mediaSession

    try {
      session.metadata = new MediaMetadata({
        title: track.title,
        artist: track.podcast,
        album: '宇宙备份',
        artwork: track.cover ? [{ src: track.cover }] : [],
      })
    } catch {
      // Metadata is a progressive enhancement.
    }

    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      [
        'play',
        () => {
          const audio = audioRef.current
          if (audio) {
            startPlayback(audio)
          }
        },
      ],
      [
        'pause',
        () => {
          audioRef.current?.pause()
        },
      ],
      ['seekbackward', (details) => skip(-(details.seekOffset ?? 15))],
      ['seekforward', (details) => skip(details.seekOffset ?? 30)],
      [
        'seekto',
        (details) => {
          if (typeof details.seekTime === 'number') {
            seek(details.seekTime)
          }
        },
      ],
      ['stop', close],
    ]

    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler)
      } catch {
        // Some actions are not supported in every browser.
      }
    }

    return () => {
      for (const [action] of handlers) {
        try {
          session.setActionHandler(action, null)
        } catch {
          // Ignore.
        }
      }
    }
  }, [track, skip, seek, close, startPlayback])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return
    }

    try {
      navigator.mediaSession.playbackState = playing
        ? 'playing'
        : track
          ? 'paused'
          : 'none'
    } catch {
      // Ignore.
    }
  }, [playing, track])

  const value = useMemo<AudioPlayerContextValue>(
    () => ({
      track,
      playing,
      loading,
      currentTime,
      duration: duration || track?.duration || 0,
      queue,
      rate,
      isCurrent: (id) => track?.id === id,
      play,
      toggle,
      pause,
      seek,
      skip,
      cycleRate,
      clearQueue,
      close,
    }),
    [track, playing, loading, currentTime, duration, queue, rate, play, toggle, pause, seek, skip, cycleRate, clearQueue, close],
  )

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={(event) => {
          const audio = event.currentTarget
          setDuration(
            Number.isFinite(audio.duration) && audio.duration > 0
              ? audio.duration
              : (trackRef.current?.duration ?? 0),
          )
        }}
        onDurationChange={(event) => {
          const audio = event.currentTarget
          if (Number.isFinite(audio.duration) && audio.duration > 0) {
            setDuration(audio.duration)
          }
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => {
          setPlaying(true)
          setLoading(false)
        }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onCanPlay={() => setLoading(false)}
        onEnded={(event) => {
          const current = trackRef.current
          const list = queueRef.current
          const index = current
            ? list.findIndex((item) => item.id === current.id)
            : -1
          const next = index >= 0 ? list[index + 1] : undefined

          if (next) {
            play(next)
            return
          }

          setPlaying(false)
          setCurrentTime(event.currentTarget.duration || 0)
        }}
        onError={() => {
          if (trackRef.current) {
            reportFailure()
          }
        }}
      />
      <AudioPlayerBar />
    </AudioPlayerContext.Provider>
  )
}

function SkipButton({
  seconds,
  direction,
  onClick,
  large = false,
}: {
  seconds: number
  direction: 'back' | 'forward'
  onClick: () => void
  large?: boolean
}) {
  const Icon = direction === 'back' ? RotateCcw : RotateCw

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === 'back' ? `后退 ${seconds} 秒` : `前进 ${seconds} 秒`}
      title={direction === 'back' ? `后退 ${seconds} 秒` : `前进 ${seconds} 秒`}
      className={cn(
        'relative grid place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none',
        large ? 'size-11' : 'size-8 sm:size-9',
      )}
    >
      <Icon
        className={large ? 'size-7' : 'size-[21px]'}
        strokeWidth={1.7}
        aria-hidden="true"
      />
      <span
        className={cn(
          'pointer-events-none absolute inset-0 grid place-items-center pt-px font-semibold tracking-tight',
          large ? 'text-[9px]' : 'text-[7.5px] leading-none',
        )}
      >
        {seconds}
      </span>
    </button>
  )
}

function AudioPlayerBar() {
  const {
    track,
    playing,
    loading,
    currentTime,
    duration,
    toggle,
    seek,
    skip,
    close,
  } = useAudioPlayer()
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    if (!track) {
      setSheetOpen(false)
    }
  }, [track])

  if (!track) {
    return null
  }

  const total = duration || track.duration || 0
  const percent = total > 0 ? Math.min(100, (currentTime / total) * 100) : 0

  return (
    <>
      {/* Keeps the end of the page above the fixed player. */}
      <div className="h-[calc(92px+env(safe-area-inset-bottom))]" aria-hidden="true" />

      <section
        aria-label="音频播放器"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_32px_-24px_rgb(0_0_0/0.35)] backdrop-blur-md"
      >
        <div className="relative">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-border"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute top-0 left-0 h-[2px] bg-brand"
            style={{ width: `${percent}%` }}
            aria-hidden="true"
          />
          <input
            type="range"
            min={0}
            max={total || 0}
            step={0.1}
            value={Math.min(currentTime, total || currentTime)}
            onChange={(event) => seek(Number(event.target.value))}
            aria-label="播放进度"
            aria-valuetext={`${clock(currentTime)} / ${clock(total)}`}
            className="player-seek absolute inset-x-0 top-0 z-10 h-4 w-full"
          />

          <div className="mx-auto flex w-full max-w-[980px] items-center gap-2.5 px-4 pt-4 pb-2.5 sm:gap-3 sm:px-6 sm:pt-3">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label="展开播放器"
              title="展开播放器"
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[4px] text-left focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none sm:gap-3"
            >
              <span className="relative size-10 shrink-0 overflow-hidden rounded-[3px] bg-muted">
                {track.cover ? (
                  <img
                    src={track.cover}
                    alt=""
                    className="size-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : null}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] leading-5 font-medium text-foreground">
                  {track.title}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-4 text-muted-foreground">
                  <span className="truncate">{track.podcast}</span>
                  <span className="shrink-0 tabular-nums">
                    {clock(currentTime)} / {clock(total)}
                  </span>
                </span>
              </span>
            </button>

            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
              <SkipButton seconds={15} direction="back" onClick={() => skip(-15)} />
              <button
                type="button"
                onClick={toggle}
                aria-label={playing ? '暂停' : '播放'}
                title={playing ? '暂停' : '播放'}
                className={cn(
                  'grid size-10 place-items-center rounded-full bg-brand text-brand-foreground transition-[background-color,transform] duration-150 hover:bg-brand/90 active:scale-95',
                  'focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
                )}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : playing ? (
                  <Pause className="size-4 fill-current" />
                ) : (
                  <Play className="ml-0.5 size-4 fill-current" />
                )}
              </button>
              <SkipButton seconds={30} direction="forward" onClick={() => skip(30)} />
            </div>

            <button
              type="button"
              onClick={close}
              aria-label="关闭播放器"
              title="关闭播放器"
              className="ml-0.5 grid size-8 shrink-0 place-items-center rounded-[4px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      </section>

      <PlayerSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  )
}

/** Fraction of the viewport the player sheet occupies. */
const DRAWER_SNAP_POINT = 0.6
const SLEEP_OPTIONS = [15, 30, 45, 60] as const

/** Full player in a bottom sheet, opened from the mini bar. */
function PlayerSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const {
    track,
    playing,
    loading,
    currentTime,
    duration,
    queue,
    rate,
    toggle,
    seek,
    skip,
    cycleRate,
    clearQueue,
    play,
    pause,
  } = useAudioPlayer()
  // The upper half of the sheet: now playing, the queue, or transcript.
  const [panel, setPanel] = useState<'queue' | 'transcribe' | null>(null)
  const [seeking, setSeeking] = useState(false)
  const [sleepUntil, setSleepUntil] = useState<number | null>(null)
  const [sleepNow, setSleepNow] = useState(() => Date.now())
  const [sleepMenuOpen, setSleepMenuOpen] = useState(false)
  const sleepMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!sleepMenuOpen) {
      return
    }

    const closeOnOutside = (event: PointerEvent) => {
      if (!sleepMenuRef.current?.contains(event.target as Node)) {
        setSleepMenuOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Close only the menu; the drawer stays open.
        event.stopPropagation()
        setSleepMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeOnOutside)
    window.addEventListener('keydown', closeOnEscape, true)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      window.removeEventListener('keydown', closeOnEscape, true)
    }
  }, [sleepMenuOpen])

  useEffect(() => {
    if (!sleepUntil) {
      return
    }

    const tick = () => {
      if (sleepUntil - Date.now() <= 0) {
        pause()
        setSleepUntil(null)
        onOpenChange(false)
        toast.success('睡眠定时结束，已暂停播放')
        return
      }
      setSleepNow(Date.now())
    }

    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [sleepUntil, pause, onOpenChange])

  // A pointer released outside the scrubber should still restore its size.
  useEffect(() => {
    if (!seeking) {
      return
    }

    const stopSeeking = () => setSeeking(false)
    window.addEventListener('pointerup', stopSeeking)
    window.addEventListener('pointercancel', stopSeeking)
    return () => {
      window.removeEventListener('pointerup', stopSeeking)
      window.removeEventListener('pointercancel', stopSeeking)
    }
  }, [seeking])

  function startSleep(minutes: number) {
    const now = Date.now()
    setSleepNow(now)
    setSleepUntil(now + minutes * 60_000)
    setSleepMenuOpen(false)
    toast.success(`将在 ${minutes} 分钟后暂停播放`)
  }

  function cancelSleep() {
    setSleepUntil(null)
    setSleepMenuOpen(false)
    toast('已取消睡眠定时')
  }

  if (!track) {
    return null
  }

  const total = duration || track.duration || 0
  const percent = total > 0 ? Math.min(100, (currentTime / total) * 100) : 0
  const remaining = Math.max(0, total - currentTime)
  const sleepMinutesLeft = sleepUntil
    ? Math.max(0, Math.ceil((sleepUntil - sleepNow) / 60_000))
    : null

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) {
          setPanel(null)
          setSleepMenuOpen(false)
        }
      }}
      snapPoints={[DRAWER_SNAP_POINT]}
      snapPoint={DRAWER_SNAP_POINT}
      // The sheet keeps a fixed height; dragging the handle down still dismisses.
      onSnapPointChange={() => {}}
    >
      <Drawer.Portal>
        <Drawer.Backdrop className="player-drawer-backdrop fixed inset-0 z-50 bg-black" />
        <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center md:justify-end md:pr-6 md:pb-[calc(63px+env(safe-area-inset-bottom)+1rem)]">
          <Drawer.Popup className="player-drawer-popup h-[60dvh] w-full max-w-[480px] overflow-hidden rounded-t-[16px] border border-b-0 border-border bg-background shadow-[0_-24px_60px_-24px_rgb(0_0_0/0.45)] outline-none sm:mb-4 sm:rounded-[12px] sm:border-b md:mb-0 md:h-[min(460px,55dvh)] md:w-[440px] md:max-w-[calc(100vw-3rem)] md:rounded-[12px] md:border-b md:shadow-[0_24px_64px_-24px_rgb(0_0_0/0.45)]">
            {/* Only the handle starts a swipe; the content below opts out. */}
            <div
              className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center select-none active:cursor-grabbing md:hidden"
              aria-hidden="true"
            >
              <span className="h-1 w-10 rounded-full bg-border" />
            </div>

            <Drawer.Content
              data-base-ui-swipe-ignore
              className="flex min-h-0 flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:pt-4"
            >
              <Drawer.Title className="sr-only">
                正在播放：{track.title}
              </Drawer.Title>
              <Drawer.Description className="sr-only">
                播放进度、倍速与播放列表
              </Drawer.Description>

              {panel === 'queue' ? (
                <div className="flex min-h-0 flex-1 flex-col pt-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading text-[16px] font-bold tracking-[-0.01em] text-foreground">
                      队列
                    </h3>
                    <button
                      type="button"
                      onClick={clearQueue}
                      disabled={queue.length <= 1}
                      className="rounded-[3px] px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                    >
                      清除
                    </button>
                  </div>

                  <div className="mt-1 min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    {queue.length > 0 ? (
                      queue.map((item) => {
                        const active = item.id === track.id
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => (active ? toggle() : play(item))}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-[4px] px-2 py-2 text-left transition-colors hover:bg-muted',
                              active && 'bg-brand-muted/70 hover:bg-brand-muted',
                            )}
                          >
                            <span className="size-10 shrink-0 overflow-hidden rounded-[4px] bg-muted">
                              {item.cover ? (
                                <img
                                  src={item.cover}
                                  alt=""
                                  className="size-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className={cn(
                                  'block truncate text-[13px] leading-5 font-medium',
                                  active ? 'text-brand' : 'text-foreground',
                                )}
                              >
                                {item.title}
                              </span>
                              <span className="block truncate text-[11px] leading-4 text-muted-foreground">
                                {item.podcast}
                                {item.duration > 0
                                  ? ` · ${formatDuration(item.duration)}`
                                  : ''}
                              </span>
                            </span>
                            {active ? (
                              <AudioLines
                                className="size-4 shrink-0 text-brand"
                                aria-hidden="true"
                              />
                            ) : null}
                          </button>
                        )
                      })
                    ) : (
                      <p className="py-8 text-center text-[12px] text-muted-foreground">
                        队列是空的。
                      </p>
                    )}
                  </div>
                </div>
              ) : panel === 'transcribe' ? (
                <div className="flex min-h-0 flex-1 flex-col pt-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading text-[16px] font-bold tracking-[-0.01em] text-foreground">
                      转译
                    </h3>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 pb-4 text-center">
                    <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
                      <Captions
                        className="size-6"
                        strokeWidth={1.6}
                        aria-hidden="true"
                      />
                    </span>
                    <div>
                      <p className="text-[14px] font-medium text-foreground">
                        敬请期待
                      </p>
                      <p className="mx-auto mt-1 max-w-[240px] text-[12px] leading-5 text-muted-foreground">
                        声音转文字功能正在开发中，完成后可在这里查看节目文字稿。
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto pt-1">
                  <div className="flex min-h-full flex-col justify-center py-2 md:py-1">
                    <div className="mx-auto aspect-square w-[min(42vw,200px)] overflow-hidden rounded-[8px] bg-muted shadow-[0_18px_40px_-24px_rgb(0_0_0/0.5)] md:w-[clamp(100px,15dvh,144px)]">
                      {track.cover ? (
                        <img
                          src={track.cover}
                          alt=""
                          className="size-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : null}
                    </div>

                    <p className="mt-4 text-[11px] font-medium text-brand">
                      {track.podcast}
                    </p>
                    <h2 className="mt-1 line-clamp-2 text-[17px] leading-6 font-semibold tracking-[-0.01em] text-foreground">
                      {track.title}
                    </h2>
                  </div>
                </div>
              )}

              <div className="shrink-0">
                <div
                  className={cn(
                    'relative mt-3 h-5 w-full origin-center transition-transform duration-150',
                    seeking && 'scale-y-[1.7]',
                  )}
                >
                  <div
                    className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-muted"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={total || 0}
                    step={0.1}
                    value={Math.min(currentTime, total || currentTime)}
                    onChange={(event) => seek(Number(event.target.value))}
                    onPointerDown={() => setSeeking(true)}
                    onPointerUp={() => setSeeking(false)}
                    onPointerCancel={() => setSeeking(false)}
                    onLostPointerCapture={() => setSeeking(false)}
                    onBlur={() => setSeeking(false)}
                    aria-label="播放进度"
                    aria-valuetext={`${clock(currentTime)} / ${clock(total)}`}
                    className="player-seek absolute inset-0 h-5 w-full"
                  />
                </div>
                <div className="mt-0.5 flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
                  <span>{clock(currentTime)}</span>
                  <span>-{clock(remaining)}</span>
                </div>

                <div className="mt-3 grid grid-cols-5 items-center justify-items-center gap-1">
                  <button
                    type="button"
                    onClick={cycleRate}
                    aria-label={`播放速度 ${rate} 倍`}
                    title="切换播放速度"
                    className="grid h-11 min-w-11 place-items-center rounded-full px-2 text-[12px] font-semibold tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
                  >
                    {rate}×
                  </button>
                  <SkipButton
                    large
                    seconds={15}
                    direction="back"
                    onClick={() => skip(-15)}
                  />
                  <button
                    type="button"
                    onClick={toggle}
                    aria-label={playing ? '暂停' : '播放'}
                    title={playing ? '暂停' : '播放'}
                    className="grid size-14 place-items-center rounded-full bg-brand text-brand-foreground transition-[background-color,transform] duration-150 hover:bg-brand/90 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
                  >
                    {loading ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : playing ? (
                      <Pause className="size-5 fill-current" />
                    ) : (
                      <Play className="ml-0.5 size-5 fill-current" />
                    )}
                  </button>
                  <SkipButton
                    large
                    seconds={30}
                    direction="forward"
                    onClick={() => skip(30)}
                  />

                  <div ref={sleepMenuRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setSleepMenuOpen((current) => !current)}
                      aria-label={
                        sleepMinutesLeft !== null
                          ? `睡眠定时，${sleepMinutesLeft} 分钟后暂停`
                          : '睡眠定时'
                      }
                      aria-haspopup="menu"
                      aria-expanded={sleepMenuOpen}
                      title={
                        sleepMinutesLeft !== null
                          ? `睡眠定时：${sleepMinutesLeft} 分钟后暂停`
                          : '睡眠定时'
                      }
                      className={cn(
                        'grid h-11 min-w-11 place-items-center rounded-full px-2 text-[12px] font-semibold tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none',
                        sleepMinutesLeft !== null
                          ? 'text-brand hover:bg-brand-muted/70'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {sleepMinutesLeft !== null ? (
                        `${sleepMinutesLeft}′`
                      ) : (
                        <Moon className="size-5" strokeWidth={1.7} />
                      )}
                    </button>

                    {sleepMenuOpen ? (
                      <div
                        role="menu"
                        aria-label="睡眠定时"
                        className="absolute right-0 bottom-full z-10 mb-2 w-44 rounded-[6px] border border-border bg-background p-1 shadow-[0_12px_32px_-16px_rgb(0_0_0/0.45)]"
                      >
                        <p className="px-2 py-1 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                          睡眠定时
                        </p>
                        <div className="grid grid-cols-2 gap-1">
                          {SLEEP_OPTIONS.map((minutes) => (
                            <button
                              key={minutes}
                              type="button"
                              role="menuitem"
                              onClick={() => startSleep(minutes)}
                              className="rounded-[4px] px-2 py-2 text-[12px] text-foreground transition-colors hover:bg-muted"
                            >
                              {minutes} 分钟
                            </button>
                          ))}
                        </div>
                        {sleepMinutesLeft !== null ? (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={cancelSleep}
                            className="mt-1 w-full rounded-[4px] px-2 py-2 text-left text-[12px] text-destructive transition-colors hover:bg-muted"
                          >
                            关闭定时
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Secondary actions live on their own centered row. */}
                <div className="mt-1 flex h-10 items-center justify-around">
                  <button
                    type="button"
                    onClick={() =>
                      setPanel((current) =>
                        current === 'transcribe' ? null : 'transcribe',
                      )
                    }
                    aria-label={panel === 'transcribe' ? '收起转译' : '转译'}
                    aria-pressed={panel === 'transcribe'}
                    title={panel === 'transcribe' ? '收起转译' : '转译'}
                    className={cn(
                      'grid size-10 place-items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none',
                      panel === 'transcribe'
                        ? 'bg-brand-muted text-brand hover:bg-brand-muted/80'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Captions className="size-5" strokeWidth={1.8} />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPanel((current) =>
                        current === 'queue' ? null : 'queue',
                      )
                    }
                    aria-label={panel === 'queue' ? '收起播放列表' : '播放列表'}
                    aria-pressed={panel === 'queue'}
                    title={panel === 'queue' ? '收起播放列表' : '播放列表'}
                    className={cn(
                      'grid size-10 place-items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none',
                      panel === 'queue'
                        ? 'bg-brand-muted text-brand hover:bg-brand-muted/80'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <List className="size-5" strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
