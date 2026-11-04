import { Link } from '@tanstack/react-router'

import { Brand } from './Logo'
import { LibraryTrigger } from './LibrarySidebar'
import { SearchCommand } from './SearchCommand'
import ThemeToggle from './ThemeToggle'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/65 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-14 w-full max-w-[980px] items-center gap-3 px-5 sm:h-[60px] sm:px-6">
        <Link
          to="/"
          search={{ url: undefined }}
          className="flex min-w-0 items-center no-underline"
        >
          <Brand />
        </Link>

        <nav className="ml-auto flex items-center gap-1">
          <SearchCommand />
          <LibraryTrigger />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
