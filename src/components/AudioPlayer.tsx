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
import { Loader2, Pause, Play, RotateCcw, RotateCw, X } from 'lucide-react'
import { toast } from 'sonner'

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
  isCurrent: (id: string) => boolean
  play: (track: PlaybackTrack) => void
  toggle: () => void
  seek: (seconds: number) => void
  skip: (delta: number) => void
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

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const trackRef = useRef<PlaybackTrack | null>(null)

  const [track, setTrack] = useState<PlaybackTrack | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

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
    (next: PlaybackTrack) => {
      const audio = audioRef.current
      if (!audio) {
        return
      }

      if (trackRef.current?.id !== next.id) {
        trackRef.current = next
        setTrack(next)
        setCurrentTime(0)
        setDuration(next.duration || 0)
        audio.src = next.src
        audio.load()
      }

      startPlayback(audio)
    },
    [startPlayback],
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

  const close = useCallback(() => {
    const audio = audioRef.current
    trackRef.current = null

    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }

    setTrack(null)
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
      isCurrent: (id) => track?.id === id,
      play,
      toggle,
      seek,
      skip,
      close,
    }),
    [track, playing, loading, currentTime, duration, play, toggle, seek, skip, close],
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
}: {
  seconds: number
  direction: 'back' | 'forward'
  onClick: () => void
}) {
  const Icon = direction === 'back' ? RotateCcw : RotateCw

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === 'back' ? `后退 ${seconds} 秒` : `前进 ${seconds} 秒`}
      title={direction === 'back' ? `后退 ${seconds} 秒` : `前进 ${seconds} 秒`}
      className="relative grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none sm:size-9"
    >
      <Icon className="size-[21px]" strokeWidth={1.7} aria-hidden="true" />
      <span className="pointer-events-none absolute inset-0 grid place-items-center pt-px text-[7.5px] leading-none font-semibold tracking-tight">
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

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] leading-5 font-medium text-foreground">
                {track.title}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-4 text-muted-foreground">
                <span className="truncate">{track.podcast}</span>
                <span className="shrink-0 tabular-nums">
                  {clock(currentTime)} / {clock(total)}
                </span>
              </p>
            </div>

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
    </>
  )
}
