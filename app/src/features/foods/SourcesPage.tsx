import { useQuery } from '@tanstack/react-query'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { formatDate } from '../../lib/format'
import { safeHttpUrl } from '../../lib/url'
import { fetchSources, type FoodSource } from './api'

const externalLink = { target: '_blank', rel: 'noopener noreferrer' } as const

/** Enlace externo solo si la dirección es http(s); si no, el texto sin enlace (T074). */
function ExternalLink({ href, children }: { href: string; children: string }) {
  const safe = safeHttpUrl(href)
  if (!safe) return <>{children}</>
  return (
    <a href={safe} className="underline" {...externalLink}>
      {children}
    </a>
  )
}

function SourceCard({ source }: { source: FoodSource }) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
      <h2 className="text-lg font-semibold">{source.name}</h2>
      <p>{source.attribution}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted">{es.foods.sources.license}</dt>
        <dd>
          <ExternalLink href={source.license_url}>{source.license_name}</ExternalLink>
        </dd>
        <dt className="text-muted">{es.foods.sources.lastImport}</dt>
        <dd>
          {source.last_imported_at
            ? formatDate(source.last_imported_at.slice(0, 10))
            : es.foods.sources.neverImported}
        </dd>
        <dt className="text-muted">{es.foods.title}</dt>
        <dd>{es.foods.sources.foodCount(source.food_count)}</dd>
      </dl>
      <p>
        <ExternalLink href={source.source_url}>{es.foods.sources.siteLink}</ExternalLink>
      </p>
    </article>
  )
}

export function SourcesPage() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['foods', 'sources'],
    queryFn: fetchSources,
  })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{es.foods.sources.title}</h1>
      <p className="text-muted">{es.foods.sources.intro}</p>
      {isPending ? <LoadingState /> : null}
      {isError ? (
        <ErrorState message={es.foods.sources.error} onRetry={() => void refetch()} />
      ) : null}
      {data && data.length === 0 ? <EmptyState title={es.foods.sources.empty} /> : null}
      {data && data.length > 0
        ? data.map((source) => <SourceCard key={source.id} source={source} />)
        : null}
    </div>
  )
}
