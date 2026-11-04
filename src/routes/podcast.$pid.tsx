import { createFileRoute, notFound } from '@tanstack/react-router'

import { PathArchive } from '@/components/PathArchive'

const ID_PATTERN = /^[0-9a-zA-Z]{24}$/

export const Route = createFileRoute('/podcast/$pid')({
  beforeLoad: ({ params }) => {
    if (!ID_PATTERN.test(params.pid)) {
      throw notFound()
    }
  },
  component: PodcastPathPage,
})

function PodcastPathPage() {
  const { pid } = Route.useParams()

  return <PathArchive kind="podcast" id={pid} />
}
