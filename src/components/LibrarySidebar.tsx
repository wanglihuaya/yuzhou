import { useMemo, type ReactNode } from 'react'
import { Bookmark, ChevronRight, Clock, Heart, X } from 'lucide-react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { Dialog as DialogPrimitive } from 'radix-ui'

import { Cover } from '@/components/Cover'
import { useLibrary } from '@/components/LibraryProvider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { canonicalLibraryUrl, type LibraryItem } from '@/lib/library'
import { cn } from '@/lib/utils'

/** Header button: opens the drawer on mobile, toggles the panel on desktop. */
export function LibraryTrigger() {
  const { setSidebarOpen, desktopPanelOpen, setDesktopPanelOpen } =
    useLibrary()

  return (
    <>
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        title="收藏与历史"
        aria-label="打开收藏与历史"
        className="grid size-9 place-items-center rounded-[4px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none lg:hidden"
      >
        <Bookmark className="size-[18px]" />
      </button>

      <button
        type="button"
        onClick={() => setDesktopPanelOpen(!desktopPanelOpen)}
        title={desktopPanelOpen ? '收起我的声音' : '打开我的声音'}
        aria-label={desktopPanelOpen ? '收起我的声音' : '打开我的声音'}
        aria-expanded={desktopPanelOpen}
        className={cn(
          'hidden size-9 place-items-center rounded-[4px] transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none lg:grid',
          desktopPanelOpen ? 'text-brand' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Bookmark className="size-[18px]" />
      </button>
    </>
  )
}

/** Floating panel anchored to the right edge on wide screens. */
export function DesktopLibrarySidebar() {
  const { desktopPanelOpen, setDesktopPanelOpen } = useLibrary()

  return (
    <aside
      aria-label="我的声音"
      className={cn(
        'fixed top-[76px] right-2 z-40 hidden w-[220px] max-h-[min(560px,calc(100dvh_-_6.25rem))] min-h-0 flex-col overflow-hidden rounded-[8px] border border-border bg-background shadow-[0_12px_40px_-18px_rgb(0_0_0/0.3)]',
        desktopPanelOpen && 'lg:flex',
      )}
    >
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 pr-2 pl-3">
        <p className="font-heading text-[14px] font-bold tracking-[-0.01em] text-foreground">
          我的声音
        </p>
        <button
          type="button"
          onClick={() => setDesktopPanelOpen(false)}
          title="收起"
          aria-label="收起我的声音"
          className="grid size-7 place-items-center rounded-[4px] text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">
        <LibraryPanel />
      </div>
    </aside>
  )
}

/** Right-side drawer used below the desktop breakpoint. */
export function MobileLibrarySheet() {
  const { sidebarOpen, setSidebarOpen } = useLibrary()

  return (
    <DialogPrimitive.Root open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/35 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-[60] flex h-dvh w-[86vw] max-w-[340px] flex-col border-l border-border bg-background px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[-16px_0_48px_-24px_rgb(0_0_0/0.35)] outline-none data-open:animate-in data-open:slide-in-from-right data-open:duration-200 data-closed:animate-out data-closed:slide-out-to-right data-closed:duration-150">
          <DialogPrimitive.Title className="sr-only">
            收藏与历史
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            本地保存的收藏播客与打开过的单集和播客
          </DialogPrimitive.Description>

          <div className="mb-3 flex h-8 shrink-0 items-center justify-between gap-3">
            <p className="font-heading text-[16px] font-bold tracking-[-0.01em] text-foreground">
              我的声音
            </p>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                aria-label="关闭"
                className="grid size-8 place-items-center rounded-[4px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </DialogPrimitive.Close>
          </div>

          <LibraryPanel onNavigate={() => setSidebarOpen(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function LibraryPanel({ onNavigate }: { onNavigate?: () => void }) {
  const { history, favorites, removeFavorite, clearHistory } = useLibrary()
  const navigate = useNavigate()
  const location = useLocation()

  const activeUrl = useMemo(() => {
    const search = location.search as { url?: string }
    return (
      canonicalLibraryUrl(search.url) ?? canonicalLibraryUrl(location.pathname)
    )
  }, [location.pathname, location.search])

  function openItem(item: LibraryItem) {
    onNavigate?.()
    void navigate({ to: '/', search: { url: item.url } })
  }

  return (
    <Tabs
      defaultValue="favorites"
      className="flex min-h-0 flex-1 flex-col gap-3"
    >
      <TabsList className="h-8 w-full rounded-[5px]">
        <TabsTrigger value="favorites" className="h-full text-[12px]">
          收藏
          {favorites.length > 0 ? (
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {favorites.length}
            </span>
          ) : null}
        </TabsTrigger>
        <TabsTrigger value="history" className="h-full text-[12px]">
          历史
          {history.length > 0 ? (
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {history.length}
            </span>
          ) : null}
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="favorites"
        className="mt-0 flex min-h-0 flex-1 flex-col outline-none"
      >
        {favorites.length > 0 ? (
          <div className="-mx-1.5 min-h-0 flex-1 overflow-y-auto pb-2">
            {favorites.map((item) => (
              <LibraryRow
                key={item.url}
                item={item}
                active={item.url === activeUrl}
                onOpen={() => openItem(item)}
                onRemove={() => removeFavorite(item.url)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Heart className="size-4" />}
            text="还没有收藏。打开一个播客，点「收藏」就会出现在这里。"
          />
        )}
      </TabsContent>

      <TabsContent
        value="history"
        className="mt-0 flex min-h-0 flex-1 flex-col outline-none"
      >
        {history.length > 0 ? (
          <>
            <div className="mb-1 flex items-center justify-between px-1.5">
              <span className="text-[10px] tracking-[0.16em] text-muted-foreground/60 uppercase">
                Recent
              </span>
              <button
                type="button"
                onClick={clearHistory}
                className="rounded-[3px] px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                清空
              </button>
            </div>
            <div className="-mx-1.5 min-h-0 flex-1 overflow-y-auto pb-2">
              {history.map((item) => (
                <LibraryRow
                  key={item.url}
                  item={item}
                  active={item.url === activeUrl}
                  onOpen={() => openItem(item)}
                />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon={<Clock className="size-4" />}
            text="打开过的单集和播客会按时间出现在这里。"
          />
        )}
      </TabsContent>
    </Tabs>
  )
}

function LibraryRow({
  item,
  active,
  onOpen,
  onRemove,
}: {
  item: LibraryItem
  active: boolean
  onOpen: () => void
  onRemove?: () => void
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-[4px] py-1.5 pr-2 pl-1.5 text-left transition-colors hover:bg-muted',
          active && 'bg-brand-muted/70 hover:bg-brand-muted',
          onRemove && 'pr-9',
        )}
      >
        <Cover
          src={item.image}
          alt=""
          className="size-8 shrink-0 rounded-[3px]"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] leading-5 font-medium text-foreground">
            {item.title}
          </span>
          <span className="block truncate text-[11px] leading-4 text-muted-foreground">
            {item.subtitle || (item.kind === 'episode' ? '单集' : '播客')}
          </span>
        </span>
      </button>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`取消收藏 ${item.title}`}
          title="取消收藏"
          className="absolute top-1/2 right-1 grid size-7 -translate-y-1/2 place-items-center rounded-[3px] text-muted-foreground/60 transition-colors hover:bg-background hover:text-destructive"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  )
}

function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex min-h-32 flex-1 flex-col items-center justify-center gap-2 rounded-[5px] border border-dashed border-border px-4 py-8 text-center">
      <span className="grid size-8 place-items-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </span>
      <p className="max-w-40 text-[11.5px] leading-5 text-muted-foreground">
        {text}
      </p>
    </div>
  )
}
