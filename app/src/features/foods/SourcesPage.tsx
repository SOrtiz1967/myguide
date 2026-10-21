import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { es } from '../../copy/es'
import { formatDate } from '../../lib/format'
import { safeHttpUrl } from '../../lib/url'
import { fetchExerciseSources } from '../exercises/api'
import { fetchSources } from './api'

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

interface SourceInfo {
  id: string
  name: string
  license_name: string
  license_url: string
  attribution: string
  source_url: string
  last_imported_at: string | null
}

/** Una fuente con su licencia, su atribución y lo que aportó (compartida por alimentos y ejercicios). */
function SourceCard({
  source,
  countLabel,
  count,
}: {
  source: SourceInfo
  countLabel: string
  count: string
}) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
      <h3 className="text-lg font-semibold">{source.name}</h3>
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
        <dt className="text-muted">{countLabel}</dt>
        <dd>{count}</dd>
      </dl>
      <p>
        <ExternalLink href={source.source_url}>{es.foods.sources.siteLink}</ExternalLink>
      </p>
    </article>
  )
}

/** Una sección con su propia carga, vacío y error: si una falla, la otra sigue visible. */
function SourceSection({
  id,
  title,
  isPending,
  isError,
  errorMessage,
  emptyMessage,
  isEmpty,
  onRetry,
  children,
}: {
  id: string
  title: string
  isPending: boolean
  isError: boolean
  errorMessage: string
  emptyMessage: string
  isEmpty: boolean
  onRetry: () => void
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      {isPending ? <LoadingState /> : null}
      {isError ? <ErrorState message={errorMessage} onRetry={onRetry} /> : null}
      {!isPending && !isError && isEmpty ? <EmptyState title={emptyMessage} /> : null}
      {children}
    </section>
  )
}

export function SourcesPage() {
  const foods = useQuery({ queryKey: ['foods', 'sources'], queryFn: fetchSources })
  const exercises = useQuery({ queryKey: ['exercises', 'sources'], queryFn: fetchExerciseSources })

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{es.foods.sources.title}</h1>
      <p className="text-muted">{es.foods.sources.intro}</p>

      <SourceSection
        id="fuentes-alimentos"
        title={es.exercises.sources.foodsTitle}
        isPending={foods.isPending}
        isError={foods.isError}
        errorMessage={es.foods.sources.error}
        emptyMessage={es.foods.sources.empty}
        isEmpty={foods.data?.length === 0}
        onRetry={() => void foods.refetch()}
      >
        {foods.data?.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            countLabel={es.foods.title}
            count={es.foods.sources.foodCount(source.food_count)}
          />
        ))}
      </SourceSection>

      <SourceSection
        id="fuentes-ejercicios"
        title={es.exercises.sources.exercisesTitle}
        isPending={exercises.isPending}
        isError={exercises.isError}
        errorMessage={es.exercises.sources.error}
        emptyMessage={es.exercises.sources.empty}
        isEmpty={exercises.data?.length === 0}
        onRetry={() => void exercises.refetch()}
      >
        {exercises.data?.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            countLabel={es.exercises.title}
            count={es.exercises.sources.exerciseCount(source.exercise_count)}
          />
        ))}
      </SourceSection>
    </div>
  )
}
