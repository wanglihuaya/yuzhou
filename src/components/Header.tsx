import { Link } from '@tanstack/react-router'
import { ArrowUpRight, Code2 } from 'lucide-react'

import ThemeToggle from './ThemeToggle'
import { Brand } from './Logo'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[980px] items-center gap-3 px-5 sm:h-[60px] sm:px-6">
        <Link
          to="/"
          search={{ url: undefined }}
          className="flex min-w-0 items-center no-underline"
        >
          <Brand />
        </Link>

        <nav className="ml-auto flex items-center gap-1">
          <a
            href="#how"
            className="hidden h-8 items-center rounded-[4px] px-2.5 text-[13px] text-muted-foreground no-underline transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
          >
            工作原理
          </a>
          <a
            href="https://github.com/LGiki/cosmos-enhanced"
            target="_blank"
            rel="noreferrer"
            className="hidden h-8 items-center gap-1 rounded-[4px] px-2.5 text-[13px] text-muted-foreground no-underline transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
          >
            灵感来源
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
          <a
            href="https://github.com/LGiki/cosmos-enhanced"
            target="_blank"
            rel="noreferrer"
            className="grid size-9 place-items-center rounded-[4px] text-muted-foreground no-underline transition-colors hover:bg-muted hover:text-foreground sm:hidden"
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
