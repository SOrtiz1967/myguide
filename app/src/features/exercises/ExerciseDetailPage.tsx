import type { ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { formatDate } from '../../lib/format'
import type { Exercise } from './api'
import {
  alsoKnownAs,
  descriptionView,
  formatEquipment,
  formatMuscles,
  measurementExplanation,
  translationLabel,
} from './exerciseText'
import { useExercise } from './useExercise'

const t = es.exercises

function Section({
  id,
  title,
  extra,
  children,
}: {
  id: string
  title: string
  extra?: string | null
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1">
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {extra ? <p className="text-sm text-muted">{extra}</p> : null}
      {children}
    </section>
  )
}

function Description({ exercise }: { exercise: Exercise }) {
  const view = descriptionView(exercise.description)
  return (
    <Section
      id="descripcion-titulo"
      title={t.detail.description}
      extra={translationLabel(exercise.description_status)}
    >
      {view.kind === 'none' ? (
        <p className="text-muted">{t.missing}</p>
      ) : view.kind === 'steps' ? (
        <ol className="ml-5 list-decimal">
          {view.steps.map((step, index) => (
            <li key={index} className="mt-1">
              {step}
            </li>
          ))}
        </ol>
      ) : (
        <p className="whitespace-pre-line break-words">{view.text}</p>
      )}
    </Section>
  )
}

function Provenance({ exercise }: { exercise: Exercise }) {
  return (
    <Section id="procedencia-titulo" title={t.provenance.title}>
      {exercise.origin === 'imported' ? (
        <>
          <p>
            {t.provenance.catalog(
              exercise.source?.name ?? '',
              exercise.source_item_id ?? '',
              exercise.imported_at ? formatDate(exercise.imported_at.slice(0, 10)) : '',
            )}
          </p>
          <p>
            <Link to="/fuentes" className="underline">
              {t.provenance.viewSources}
            </Link>
          </p>
        </>
      ) : exercise.based_on ? (
        <p>
          {t.provenance.ownBasedOnPrefix}{' '}
          <Link to={`/ejercicios/${exercise.based_on.id}`} className="underline">
            {exercise.based_on.name}
          </Link>
        </p>
      ) : (
        <p>{t.provenance.own}</p>
      )}
    </Section>
  )
}

/** Las acciones según el origen: del catálogo solo se puede crear una versión propia (FR-028). */
function Actions({ exercise }: { exercise: Exercise }) {
  return (
    <div className="flex flex-wrap gap-3">
      {exercise.origin === 'imported' ? (
        <button type="button" className="btn-primary">
          {t.actions.createMine}
        </button>
      ) : (
        <>
          <Link to={`/ejercicios/${exercise.id}/editar`} className="btn-primary">
            {t.actions.edit}
          </Link>
          <button type="button" className="btn-secondary">
            {t.actions.copy}
          </button>
          <button type="button" className="btn-secondary">
            {t.actions.delete}
          </button>
        </>
      )}
    </div>
  )
}

export function ExerciseDetailPage() {
  const { id = '' } = useParams()
  const state = useLocation().state as { from?: string; saved?: boolean } | null
  const from = state?.from ?? ''
  const { data: exercise, isPending, isError, refetch } = useExercise(id)
  const back = (
    <Link to={`/ejercicios${from}`} className="inline-flex min-h-11 items-center underline">
      {t.backToSearch}
    </Link>
  )

  if (isPending) return <LoadingState />
  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <ErrorState message={t.detailError} onRetry={() => void refetch()} />
      </div>
    )
  }
  if (!exercise) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState title={t.notFound} />
        {back}
      </div>
    )
  }

  const others = alsoKnownAs(exercise)
  const nameLabel = translationLabel(exercise.name_status)

  return (
    <div className="flex flex-col gap-6">
      <div>{back}</div>
      {state?.saved ? <SuccessMessage>{t.form.saved}</SuccessMessage> : null}
      <header className="flex flex-col gap-1">
        <h1 className="break-words text-2xl font-semibold tracking-tight">{exercise.name}</h1>
        {nameLabel ? <p className="text-sm text-muted">{nameLabel}</p> : null}
      </header>

      {others.length > 0 ? (
        <Section id="otros-nombres-titulo" title={t.detail.alsoKnownAs}>
          <ul className="flex flex-wrap gap-x-4">
            {others.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section id="medicion-titulo" title={t.detail.measurement}>
        <p>{measurementExplanation(exercise.measurement_type)}</p>
      </Section>
      <Section id="musculos-principales-titulo" title={t.detail.primaryMuscles}>
        <p>{formatMuscles(exercise.primary_muscles)}</p>
      </Section>
      <Section id="musculos-secundarios-titulo" title={t.detail.secondaryMuscles}>
        <p>{formatMuscles(exercise.secondary_muscles)}</p>
      </Section>
      <Section id="equipamiento-titulo" title={t.detail.equipment}>
        <p>{formatEquipment(exercise.equipment)}</p>
      </Section>
      <Description exercise={exercise} />
      <Provenance exercise={exercise} />
      <Actions exercise={exercise} />
    </div>
  )
}
