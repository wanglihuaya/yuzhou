import { Link } from '@tanstack/react-router'

import { Brand } from './Logo'
import ThemeToggle from './ThemeToggle'

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
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
