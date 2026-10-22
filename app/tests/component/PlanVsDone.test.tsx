// T044 (spec 006, escenarios 18 a 26; FR-015 a FR-020): el plan y lo realizado, en bloques separados.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useMemo, useReducer, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import type { PlanItem, WorkoutSession } from '../../src/features/training/api'
import { PlanSection, PlanTag } from '../../src/features/training/PlanVsDone'
import { SessionEditor } from '../../src/features/training/SessionEditor'
import { SessionSummaryView } from '../../src/features/training/SessionSummaryView'
import { editorReducer, emptyDraft } from '../../src/features/training/sessionEditorState'
import { buildSessionPayload } from '../../src/features/training/schema'

const t = es.training
const p = t.plan
const e = t.editor

function planItem(over: Partial<PlanItem> = {}): PlanItem {
  return {
    id: 'p1',
    session_id: 's1',
    position: 1,
    exercise_id: 'e1',
    exercise_name: 'Press',
    measurement_type: 'reps_weight',
    sets: 4,
    target_reps: 8,
    target_weight_kg: 60,
    target_duration_s: null,
    target_distance_km: null,
    targets_dropped: false,
    ...over,
  }
}

const PLAN = [
  planItem(),
  planItem({
    id: 'p2',
    position: 2,
    exercise_id: 'e2',
    exercise_name: 'Plancha',
    measurement_type: 'duration',
    sets: 2,
    target_reps: null,
    target_weight_kg: null,
    target_duration_s: 90,
  }),
]

function Harness({
  items = PLAN,
  onSubstitute = () => {},
  finished = false,
  children,
}: {
  items?: PlanItem[]
  onSubstitute?: (item: PlanItem) => void
  finished?: boolean
  children?: ReactNode
}) {
  const [draft, dispatch] = useReducer(editorReducer, emptyDraft())
  const built = useMemo(() => buildSessionPayload(draft), [draft])
  return (
    <MemoryRouter>
      {children}
      <SessionEditor
        draft={draft}
        dispatch={dispatch}
        errors={built.ok ? null : built.errors}
        indicator="saved"
        onAddExercise={() => {
          dispatch({
            type: 'addExercise',
            exercise: {
              id: 'extra',
              exercise_id: 'e9',
              exercise_name: 'Curl',
              measurement_type: 'reps_weight',
            },
          })
        }}
        onFinish={() => {}}
        header={
          <PlanSection
            plan={items}
            draft={draft}
            dispatch={dispatch}
            onSubstitute={onSubstitute}
            finished={finished}
          />
        }
        renderExtra={(id) => <PlanTag plan={items} draft={draft} exerciseId={id} />}
      />
    </MemoryRouter>
  )
}

const planItemEl = (name: string) =>
  within(screen.getByRole('list', { name: p.title })).getByRole('listitem', {
    name: new RegExp(`^${name}`),
  })

describe('el plan (FR-015, FR-016)', () => {
  it('muestra cada ítem con sus series y su objetivo como referencia, sin hacer todavía', () => {
    render(<Harness />)
    const press = within(planItemEl('Press'))
    expect(press.getByText(es.training.routines.setsOf(4))).toBeVisible()
    expect(press.getByText(`${p.reference}: 8 repeticiones · 60 kg`)).toBeVisible()
    expect(press.getByText(p.pending)).toBeVisible()
    expect(within(planItemEl('Plancha')).getByText(`${p.reference}: 1:30 min`)).toBeVisible()
  })

  it('el objetivo es una referencia: nunca aparece como un valor ya anotado', async () => {
    render(<Harness />)
    await userEvent.click(within(planItemEl('Press')).getByRole('button', { name: p.doIt }))
    const card = within(screen.getByRole('article', { name: 'Press' }))
    expect(card.getByLabelText(e.fieldOfSet(t.fields.reps, 1))).toHaveValue('')
    expect(card.getByLabelText(e.fieldOfSet(t.fields.weight_kg, 1))).toHaveValue('')
  })

  it('«Hacer este ejercicio» lo agrega al bloque de realizado, vinculado al plan', async () => {
    render(<Harness />)
    await userEvent.click(within(planItemEl('Press')).getByRole('button', { name: p.doIt }))
    const card = screen.getByRole('article', { name: 'Press' })
    expect(within(card).getByText(p.tagPlan)).toBeVisible()
    // ya no se ofrece dos veces
    expect(within(planItemEl('Press')).queryByRole('button', { name: p.doIt })).toBeNull()
    // pasa a «hecho» cuando tiene series con datos
    expect(within(planItemEl('Press')).getByText(p.pending)).toBeVisible()
    await userEvent.type(within(card).getByLabelText(e.fieldOfSet(t.fields.reps, 1)), '8')
    expect(within(planItemEl('Press')).getByText(p.done)).toBeVisible()
  })

  it('sustituir pide el ejercicio sustituto y conserva el original en el plan', async () => {
    const onSubstitute = vi.fn()
    render(<Harness onSubstitute={onSubstitute} />)
    await userEvent.click(within(planItemEl('Press')).getByRole('button', { name: p.substitute }))
    expect(onSubstitute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1', exercise_name: 'Press' }),
    )
  })

  it('un ejercicio agregado fuera del plan se ve como «No estaba en el plan»', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: e.addExercise }))
    expect(
      within(screen.getByRole('article', { name: 'Curl' })).getByText(p.tagAdded),
    ).toBeVisible()
  })

  it('un ítem sin ejercicio vigente solo se puede sustituir', () => {
    render(<Harness items={[planItem({ exercise_id: null })]} />)
    const press = within(planItemEl('Press'))
    expect(press.getByText(p.missingExercise)).toBeVisible()
    expect(press.queryByRole('button', { name: p.doIt })).toBeNull()
    expect(press.getByRole('button', { name: p.substitute })).toBeVisible()
  })

  it('avisa si no se copiaron objetivos de la rutina (FR-037)', () => {
    render(<Harness items={[planItem({ targets_dropped: true })]} />)
    expect(within(planItemEl('Press')).getByText(p.droppedTargets)).toBeVisible()
  })

  it('al terminar, lo que no se hizo dice «No realizado», sin acciones', () => {
    render(<Harness finished />)
    const press = within(planItemEl('Press'))
    expect(press.getByText(p.notDone)).toBeVisible()
    expect(press.queryByRole('button')).toBeNull()
  })
})

describe('una sesión terminada (escenarios 22 a 26)', () => {
  function session(over: Partial<WorkoutSession> = {}): WorkoutSession {
    return {
      id: 's1',
      session_date: '2026-10-22',
      original_date: '2026-10-22',
      status: 'completed',
      routine_id: 'r1',
      routine_name: 'Torso A',
      has_plan: true,
      note: null,
      modified: false,
      rescheduled_count: 0,
      corrected_at: null,
      started_at: '2026-10-22T10:00:00Z',
      finished_at: '2026-10-22T11:00:00Z',
      revision: 3,
      session_plan_items: PLAN,
      session_date_changes: [],
      session_exercises: [
        {
          id: 'x1',
          position: 1,
          exercise_id: 'e1',
          exercise_name: 'Press',
          measurement_type: 'reps_weight',
          plan_item_id: 'p1',
          is_substitute: false,
          effort: null,
          note: null,
          session_sets: Array.from({ length: 4 }, (_, i) => ({
            id: `a${i}`,
            position: i + 1,
            reps: 7,
            weight_kg: 55,
            duration_s: null,
            distance_km: null,
          })),
        },
        {
          id: 'x2',
          position: 2,
          exercise_id: 'e2',
          exercise_name: 'Plancha',
          measurement_type: 'duration',
          plan_item_id: 'p2',
          is_substitute: false,
          effort: null,
          note: null,
          session_sets: Array.from({ length: 2 }, (_, i) => ({
            id: `b${i}`,
            position: i + 1,
            reps: null,
            weight_kg: null,
            duration_s: 60,
            distance_km: null,
          })),
        },
      ],
      ...over,
    }
  }

  const view = (s: WorkoutSession) =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <SessionSummaryView session={s} />
        </MemoryRouter>
      </QueryClientProvider>,
    )

  it('igual al plan, con otros valores: «Realizada» sin la marca «Modificada»', () => {
    view(session())
    expect(screen.getByText(new RegExp(t.status.completed))).toBeVisible()
    expect(screen.queryByText(new RegExp(t.marks.modified))).toBeNull()
    expect(screen.queryByText(p.differencesTitle)).toBeNull()
    // el plan y lo realizado están en bloques distintos
    expect(screen.getByRole('heading', { name: p.title })).toBeVisible()
    expect(screen.getByRole('heading', { name: p.doneTitle })).toBeVisible()
  })

  it('con diferencias de ejercicios muestra la marca y en qué difiere', () => {
    const s = session({ modified: true })
    s.session_exercises = [s.session_exercises[0]!]
    s.session_exercises.push({
      ...s.session_exercises[0]!,
      id: 'x3',
      position: 2,
      exercise_id: 'e9',
      exercise_name: 'Curl',
      plan_item_id: null,
    })
    view(s)
    expect(screen.getByText(new RegExp(t.marks.modified))).toBeVisible()
    expect(screen.getByText(p.differencesTitle)).toBeVisible()
    expect(screen.getByText(p.diff.not_done('Plancha'))).toBeVisible()
    expect(screen.getByText(p.diff.added('Curl'))).toBeVisible()
  })

  it('una sustitución muestra el original y el sustituto', () => {
    const s = session({ modified: true })
    s.session_exercises = [
      s.session_exercises[0]!,
      {
        ...s.session_exercises[1]!,
        id: 'x4',
        exercise_name: 'Plancha lateral',
        is_substitute: true,
      },
    ]
    view(s)
    expect(screen.getByText(p.diff.substituted('Plancha', 'Plancha lateral'))).toBeVisible()
  })

  it('una sesión sin plan dice «Sin planificación»', () => {
    view(session({ has_plan: false, session_plan_items: [], routine_id: null, routine_name: null }))
    expect(screen.getByText(t.noPlan)).toBeVisible()
  })

  it('si la rutina ya no existe, el plan se conserva y se dice', () => {
    view(session({ routine_id: null }))
    expect(screen.getByText(p.routineGone)).toBeVisible()
    expect(screen.getByText(p.fromRoutine('Torso A'))).toBeVisible()
  })
})
