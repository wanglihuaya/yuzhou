import { createFileRoute, notFound } from '@tanstack/react-router'

import { PathArchive } from '@/components/PathArchive'
import { loaderShareMeta, shareHead } from '@/lib/share-meta'

const ID_PATTERN = /^[0-9a-zA-Z]{24}$/

export const Route = createFileRoute('/episode/$eid')({
  beforeLoad: ({ params }) => {
    if (!ID_PATTERN.test(params.eid)) {
      throw notFound()
    }
  },
  loader: ({ params }) =>
    loaderShareMeta(
      `https://www.xiaoyuzhoufm.com/episode/${params.eid}`,
    ),
  head: ({ loaderData }) => shareHead(loaderData),
  component: EpisodePathPage,
})

function EpisodePathPage() {
  const { eid } = Route.useParams()

  return <PathArchive kind="episode" id={eid} />
}
