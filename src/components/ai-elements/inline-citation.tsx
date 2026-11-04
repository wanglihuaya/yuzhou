import type { ReactNode } from 'react'

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { cn } from '@/lib/utils'

export interface InlineCitationProps {
  /** Address shown inside the hover card. */
  url: string
  /** Short label, e.g. "本页链接". */
  title: string
  /** The trigger element (usually a Button). */
  children: ReactNode
  className?: string
  contentClassName?: string
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * A compact, hoverable source reference in the style of shadcn's
 * ai-elements inline citation. The trigger is supplied by the caller so it can
 * also perform an action (such as copying the link).
 */
export function InlineCitation({
  url,
  title,
  children,
  className,
  contentClassName,
}: InlineCitationProps) {
  return (
    <HoverCard openDelay={120} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        align="center"
        sideOffset={6}
        className={cn('flex w-72 flex-col gap-1.5', contentClassName)}
      >
        <p className="text-[12px] font-medium text-foreground">{title}</p>
        <p className="break-all text-[11px] leading-5 text-muted-foreground">
          {url}
        </p>
        <p
          className={cn(
            'mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-brand',
            className,
          )}
        >
          <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
          {hostnameOf(url)}
        </p>
      </HoverCardContent>
    </HoverCard>
  )
}
