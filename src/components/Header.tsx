import { Link } from '@tanstack/react-router'
import { Code2, Orbit } from 'lucide-react'

import ThemeToggle from './ThemeToggle'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[max(0.75rem,env(safe-area-inset-top))] bg-background"
      />
      <div className="relative mx-auto flex h-14 w-full max-w-6xl items-center gap-2 rounded-2xl bg-card px-3 sm:px-4">
        <Link
          to="/"
          search={{ url: undefined }}
          className="flex min-w-0 items-center gap-2.5 no-underline"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-[0.625rem] bg-primary text-primary-foreground">
            <Orbit className="size-[18px]" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col leading-none">
            <span className="truncate text-[15px] font-medium tracking-tight text-foreground">
              宇宙备份
            </span>
            <span className="mt-1 font-mono text-[9px] tracking-[0.22em] text-muted-foreground uppercase">
              Cosmos Archive
            </span>
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-1">
          <a
            href="#how"
            className="hidden h-9 items-center rounded-lg px-3 text-[13px] font-medium text-muted-foreground no-underline transition-colors hover:bg-muted/50 hover:text-foreground sm:inline-flex"
          >
            工作原理
          </a>
          <a
            href="https://github.com/LGiki/cosmos-enhanced"
            target="_blank"
            rel="noreferrer"
            className="hidden size-9 items-center justify-center rounded-lg text-muted-foreground no-underline transition-colors hover:bg-muted/50 hover:text-foreground sm:inline-flex"
            aria-label="查看灵感来源 Cosmos Enhanced"
          >
            <Code2 className="size-4" />
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
