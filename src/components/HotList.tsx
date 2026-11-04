import { useEffect, useState } from 'react'
import { Flame } from 'lucide-react'

import { Cover } from '@/components/Cover'
import { formatCount } from '@/lib/format'
import { getHotEpisodes, type HotEpisode } from '@/lib/hot'
import { cn } from '@/lib/utils'

const VISIBLE_COUNT = 10

/**
 * Weekly Xiaoyuzhou chart shown on the empty homepage.
 * Data comes from the public 中文播客榜 API; when it is unreachable
 * the whole section quietly disappears instead of blocking the page.
 */
export function HotList({ onOpen }: { onOpen: (url: string) => void }) {
  const [items, setItems] = useState<HotEpisode[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    getHotEpisodes()
      .then((result) => {
        if (cancelled) return
        if (result.ok && result.items.length > 0) {
          setItems(result.items)
        } else {
          setFailed(true)
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (failed) {
    return null
  }

  if (items === null) {
    return (
      <section className="mx-auto mt-10 max-w-[640px]">
        <HotHeader />
        <div className="mt-2 grid grid-cols-1 gap-x-5 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="flex items-center gap-2.5 py-2"
              aria-hidden="true"
            >
              <span className="h-3 w-4 shrink-0 animate-pulse rounded-[2px] bg-muted" />
              <span className="size-9 shrink-0 animate-pulse rounded-[4px] bg-muted" />
              <span className="min-w-0 flex-1 space-y-1.5">
                <span className="block h-2.5 w-4/5 animate-pulse rounded-full bg-muted" />
                <span className="block h-2 w-2/5 animate-pulse rounded-full bg-muted" />
              </span>
            </div>
          ))}
        </div>
      </section>
    )
  }

  const visible = items.slice(0, VISIBLE_COUNT)

  return (
    <section className="mx-auto mt-10 max-w-[640px]">
      <HotHeader />

      <div className="mt-2 grid grid-cols-1 gap-x-5 sm:grid-cols-2">
        {visible.map((item, index) => (
          <button
            key={item.url}
            type="button"
            onClick={() => onOpen(item.url)}
            title={`解析：${item.title}`}
            className="group flex w-full items-center gap-2.5 rounded-[4px] py-2 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
          >
            <span
              className={cn(
                'w-4 shrink-0 text-center font-heading text-[13px] font-bold tabular-nums',
                index < 3 ? 'text-brand' : 'text-muted-foreground/60',
              )}
            >
              {index + 1}
            </span>
            <Cover
              src={item.image}
              alt=""
              className="size-9 shrink-0 rounded-[4px]"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] leading-5 font-medium text-foreground transition-colors group-hover:text-brand">
                {item.title}
              </span>
              <span className="block truncate text-[11px] leading-4 text-muted-foreground">
                {item.podcast || '小宇宙'}
                {item.playCount > 0
                  ? ` · ${formatCount(item.playCount)} 播放`
                  : ''}
              </span>
            </span>
          </button>
        ))}
      </div>

      <p className="mt-3 text-center text-[10.5px] text-muted-foreground/70 sm:text-left">
        近期热门单集，点击即可解析 · 榜单数据来自{' '}
        <a
          href="https://xyzrank.com"
          target="_blank"
          rel="noreferrer noopener"
          className="text-muted-foreground underline decoration-border underline-offset-2 transition-colors hover:text-brand"
        >
          中文播客榜
        </a>
      </p>
    </section>
  )
}

function HotHeader() {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2">
      <h2 className="inline-flex items-center gap-1.5 font-heading text-[15px] font-bold tracking-[-0.01em] text-foreground">
        <Flame className="size-4 text-brand" aria-hidden="true" />
        热榜
      </h2>
      <span className="text-[10px] tracking-[0.16em] text-muted-foreground/60 uppercase">
        Weekly
      </span>
    </div>
  )
}
