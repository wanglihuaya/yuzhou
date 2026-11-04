import { useState } from 'react'
import { Disc3 } from 'lucide-react'

import { cn } from '@/lib/utils'

export function Cover({
  src,
  alt,
  className,
}: {
  src: string
  alt: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div
        className={cn(
          'grid place-items-center bg-muted text-muted-foreground',
          className,
        )}
      >
        <Disc3 className="size-1/3 opacity-40" aria-hidden="true" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  )
}
