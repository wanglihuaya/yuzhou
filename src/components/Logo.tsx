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

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark className="size-[26px] shrink-0" />
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-[17px] font-bold tracking-tight text-foreground">
          宇宙备份
        </span>
        <span className="hidden text-[12px] text-muted-foreground sm:inline">
          小宇宙的离线备份
        </span>
      </span>
    </span>
  )
}
