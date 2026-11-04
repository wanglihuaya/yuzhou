import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn('size-7', className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id="cosmos-logo-gradient"
          x1="3"
          y1="2"
          x2="30"
          y2="31"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#25B4E1" />
          <stop offset="0.46" stopColor="#85C5D0" />
          <stop offset="0.78" stopColor="#C7CFC5" />
          <stop offset="1" stopColor="#E5D5BE" />
        </linearGradient>
      </defs>
      {/* A thin orbit, the way the reference mark wraps its own ring. */}
      <ellipse
        cx="16"
        cy="16"
        rx="6"
        ry="14.2"
        transform="rotate(28 16 16)"
        fill="none"
        stroke="url(#cosmos-logo-gradient)"
        strokeWidth="1.5"
        opacity="0.5"
      />
      {/* A crescent: the archive keeps one half of the sky. */}
      <path
        d="M22.6 4.7a12.9 12.9 0 1 0 0 22.6c-4.8-2.6-7.9-6.4-7.9-11.3s3.1-8.7 7.9-11.3Z"
        fill="url(#cosmos-logo-gradient)"
      />
      <circle cx="24.4" cy="8.3" r="1.55" fill="var(--background)" />
      <circle
        cx="24.4"
        cy="8.3"
        r="1.55"
        fill="none"
        stroke="url(#cosmos-logo-gradient)"
        strokeWidth="1.1"
      />
    </svg>
  )
}

/** lucide-react no longer ships brand marks, so the GitHub mark is inline. */
export function GithubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-4', className)}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.2-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.75.81 1.2 1.84 1.2 3.1 0 4.43-2.7 5.4-5.26 5.69.41.35.78 1.05.78 2.12v3.14c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z"
      />
    </svg>
  )
}

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark className="size-[26px] shrink-0" />
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-[17px] font-bold tracking-tight text-foreground">
          宇宙备份
        </span>
        {/* <span className="hidden text-[12px] text-muted-foreground sm:inline">
          小宇宙的离线备份
        </span> */}
      </span>
    </span>
  )
}
