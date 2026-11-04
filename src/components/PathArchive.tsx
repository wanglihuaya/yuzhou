import { useNavigate } from '@tanstack/react-router'

import { ArchiveApp } from '@/components/ArchiveApp'

/**
 * Renders the archive from a path-style URL (`/episode/<id>`, `/podcast/<id>`).
 * The canonical xiaoyuzhoufm.com URL is what the resolver understands; the
 * address bar keeps the path the user arrived on.
 */
export function PathArchive({
  kind,
  id,
}: {
  kind: 'episode' | 'podcast'
  id: string
}) {
  const navigate = useNavigate()
  const canonical = `https://www.xiaoyuzhoufm.com/${kind}/${id}`

  return (
    <ArchiveApp
      urlParam={canonical}
      onUrlChange={(nextUrl) => {
        void navigate({ to: '/', search: { url: nextUrl } })
      }}
    />
  )
}
