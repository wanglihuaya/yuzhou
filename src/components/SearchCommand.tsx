import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  CornerDownLeft,
  Database,
  Loader2,
  Search as SearchIcon,
  X,
} from 'lucide-react'

import { Cover } from '@/components/Cover'
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { formatCount, formatDuration } from '@/lib/format'
import { searchEpisodes, type SearchEpisode } from '@/lib/search'
import { cn } from '@/lib/utils'

type SearchStatus = 'idle' | 'loading' | 'ready' | 'error'

const DEBOUNCE_MS = 260
const SUGGESTIONS = ['半拿铁', '忽左忽右', '故事FM']

function resultMeta(item: SearchEpisode): string {
  return [
    item.podcast || '小宇宙',
    item.duration > 0 ? formatDuration(item.duration) : '',
    item.playCount > 0 ? `${formatCount(item.playCount)} 播放` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Header search trigger and the Cmd/Ctrl+K command palette.
 * Results are resolved by navigating to the home page with `?url=`, which
 * reuses the app's existing episode parsing flow.
 */
export function SearchCommand() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<SearchEpisode[]>([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [active, setActive] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [shortcut, setShortcut] = useState('⌘K')
  const requestSeq = useRef(0)

  useEffect(() => {
    const isApple = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent)
    setShortcut(isApple ? '⌘K' : 'Ctrl K')
  }, [])

  // Cmd+K on Apple platforms, Ctrl+K everywhere else.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return
      }
      if (!(event.metaKey || event.ctrlKey) || event.altKey) {
        return
      }
      if (event.key.toLowerCase() !== 'k' && event.code !== 'KeyK') {
        return
      }

      event.preventDefault()
      setOpen((current) => !current)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useEffect(() => {
    if (open) {
      return
    }

    requestSeq.current += 1
    setQuery('')
    setItems([])
    setTotal(0)
    setStatus('idle')
    setActive('')
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const term = query.trim()
    const seq = requestSeq.current + 1
    requestSeq.current = seq

    if (!term) {
      setItems([])
      setTotal(0)
      setStatus('idle')
      setActive('')
      return
    }

    setStatus('loading')
    setItems([])
    setTotal(0)
    setActive('')

    const timer = window.setTimeout(() => {
      searchEpisodes({ data: term })
        .then((result) => {
          if (requestSeq.current !== seq) {
            return
          }
          if (!result.ok) {
            setItems([])
            setTotal(0)
            setStatus('error')
            return
          }

          setItems(result.items)
          setTotal(result.total)
          setStatus('ready')
          setActive(result.items[0]?.url ?? '')
        })
        .catch(() => {
          if (requestSeq.current !== seq) {
            return
          }
          setItems([])
          setTotal(0)
          setStatus('error')
        })
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [query, open, retryKey])

  function openResult(item: SearchEpisode) {
    setOpen(false)
    void navigate({ to: '/', search: { url: item.url } })
  }

  function clearQuery() {
    setQuery('')
  }

  const loading = status === 'loading'
  const trimmedQuery = query.trim()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="搜索小宇宙"
        aria-keyshortcuts="Meta+K Control+K"
        title={`搜索小宇宙（${shortcut}）`}
        className="grid size-9 place-items-center rounded-[4px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none sm:hidden"
      >
        <SearchIcon className="size-[18px]" />
      </button>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="搜索小宇宙"
        aria-keyshortcuts="Meta+K Control+K"
        title={`搜索小宇宙（${shortcut}）`}
        className="hidden h-8 w-[168px] items-center gap-2 rounded-[4px] border border-border bg-background px-2.5 text-left text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none sm:flex"
      >
        <SearchIcon className="size-3.5 shrink-0" />
        <span className="flex-1">搜索</span>
        <kbd className="rounded-[2px] border border-border bg-muted/60 px-1 font-sans text-[10px] leading-4 text-muted-foreground/80">
          {shortcut}
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="搜索小宇宙"
        description="按关键词搜索小宇宙单集，选中后直接解析。"
        className="command-dialog sm:max-w-[600px]"
        commandProps={{
          shouldFilter: false,
          loop: true,
          value: active,
          onValueChange: setActive,
        }}
      >
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="搜索单集、播客、主播…"
          aria-label="搜索单集、播客、主播"
          className="pr-1"
          trailing={
            loading ? (
              <Loader2
                className="size-4 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
            ) : query ? (
              <button
                type="button"
                onClick={clearQuery}
                onMouseDown={(event) => event.preventDefault()}
                aria-label="清空搜索"
                className="grid size-6 place-items-center rounded-[3px] text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
              >
                <X className="size-3.5" />
              </button>
            ) : null
          }
        />

        <CommandList aria-label="搜索结果">
          {!trimmedQuery ? (
            <>
              <div className="px-6 pt-7 pb-5 text-center">
                <span className="mx-auto grid size-10 place-items-center rounded-full bg-muted text-muted-foreground/80">
                  <SearchIcon className="size-4" aria-hidden="true" />
                </span>
                <p className="mt-3 text-[13px] font-medium text-foreground">
                  搜索小宇宙
                </p>
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  输入节目名、主播或关键词，找到单集后直接解析
                </p>
              </div>

              <CommandGroup heading="试试搜索">
                {SUGGESTIONS.map((suggestion) => (
                  <CommandItem
                    key={suggestion}
                    value={`suggestion:${suggestion}`}
                    onSelect={() => setQuery(suggestion)}
                  >
                    <SearchIcon className="size-3.5 text-muted-foreground/60" />
                    <span className="text-[13px]">{suggestion}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : status === 'error' ? (
            <div className="px-6 py-10 text-center">
              <p className="text-[13px] font-medium text-foreground">
                搜索暂时不可用
              </p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                请检查网络，或稍后再试。
              </p>
              <button
                type="button"
                onClick={() => setRetryKey((current) => current + 1)}
                className="mt-3 inline-flex h-8 items-center rounded-[4px] border border-border bg-background px-3 text-[12px] text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
              >
                重试
              </button>
            </div>
          ) : loading && items.length === 0 ? (
            <div className="p-2" aria-hidden="true">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="flex items-center gap-3 px-2 py-2.5">
                  <span className="size-10 shrink-0 animate-pulse rounded-[4px] bg-muted" />
                  <span className="min-w-0 flex-1 space-y-2">
                    <span className="block h-2.5 w-4/5 animate-pulse rounded-full bg-muted" />
                    <span className="block h-2 w-2/5 animate-pulse rounded-full bg-muted" />
                  </span>
                </div>
              ))}
              <p className="sr-only" role="status">
                正在搜索
              </p>
            </div>
          ) : items.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-[13px] font-medium text-foreground">
                没有找到相关单集
              </p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                换个节目名、主播或更短的关键词试试。
              </p>
            </div>
          ) : (
            <CommandGroup
              heading={
                total > items.length
                  ? `找到 ${total} 集 · 显示前 ${items.length} 集`
                  : `找到 ${total} 集`
              }
            >
              {items.map((item) => (
                <CommandItem
                  key={item.url}
                  value={item.url}
                  onSelect={() => openResult(item)}
                  className="gap-3 px-2 py-2"
                >
                  <Cover
                    src={item.image}
                    alt=""
                    className="size-10 shrink-0 rounded-[4px]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] leading-5 font-medium text-foreground">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] leading-4 text-muted-foreground">
                      {resultMeta(item)}
                    </span>
                  </span>
                  <CornerDownLeft
                    className={cn(
                      'size-3.5 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity',
                      active === item.url && 'opacity-100',
                    )}
                    aria-hidden="true"
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>

        <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-t border-border px-4 text-[10.5px] text-muted-foreground">
          <div className="hidden items-center gap-3 sm:flex">
            <span className="inline-flex items-center gap-1.5">
              <kbd className="rounded-[2px] border border-border bg-muted/50 px-1 font-sans leading-4">
                ↑↓
              </kbd>
              选择
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="rounded-[2px] border border-border bg-muted/50 px-1 font-sans leading-4">
                ↵
              </kbd>
              打开
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="rounded-[2px] border border-border bg-muted/50 px-1 font-sans leading-4">
                esc
              </kbd>
              关闭
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 sm:ml-auto">
            <Database className="size-3" aria-hidden="true" />
            数据来自
            <a
              href="https://xyzrank.com"
              target="_blank"
              rel="noreferrer noopener"
              className="text-foreground/80 underline decoration-border underline-offset-2 transition-colors hover:text-brand"
            >
              中文播客榜
            </a>
          </span>
        </div>
      </CommandDialog>
    </>
  )
}
