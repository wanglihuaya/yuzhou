import { createFileRoute } from '@tanstack/react-router'

import { ArchiveApp } from '@/components/ArchiveApp'
import { loaderShareMeta, shareHead } from '@/lib/share-meta'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>) => ({
    url:
      typeof search.url === 'string' && search.url.trim()
        ? search.url.trim()
        : undefined,
  }),
  loaderDeps: ({ search }) => ({ url: search.url }),
  loader: ({ deps }) => loaderShareMeta(deps.url),
  head: ({ loaderData }) => shareHead(loaderData),
  component: HomePage,
})

function HomePage() {
  const { url } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <ArchiveApp
      urlParam={url}
      onUrlChange={(nextUrl) => {
        void navigate({
          to: '/',
          search: { url: nextUrl },
        })
      }}
    />
  )
}
