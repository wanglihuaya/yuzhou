import { createFileRoute, notFound } from '@tanstack/react-router'

import { PathArchive } from '@/components/PathArchive'

const ID_PATTERN = /^[0-9a-zA-Z]{24}$/

export const Route = createFileRoute('/episode/$eid')({
  beforeLoad: ({ params }) => {
    if (!ID_PATTERN.test(params.eid)) {
      throw notFound()
    }
  },
  component: EpisodePathPage,
})

function EpisodePathPage() {
  const { eid } = Route.useParams()

  return <PathArchive kind="episode" id={eid} />
}
