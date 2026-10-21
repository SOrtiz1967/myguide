// T020 (spec 006, escenarios 1 a 9; FR-014, FR-028 a FR-033, FR-046): el editor de una sesión.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useMemo, useReducer } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { SessionEditor } from '../../src/features/training/SessionEditor'
import { editorReducer, emptyDraft } from '../../src/features/training/sessionEditorState'
import { buildSessionPayload, type SessionDraft } from '../../src/features/training/schema'
import type { EditorIndicator } from '../../src/features/training/useSessionEditor'

const t = es.training
const e = t.editor

const EXERCISES = {
  press: {
    id: 'x1',
    exercise_id: 'e1',
    exercise_name: 'Press',
    measurement_type: 'reps_weight' as const,
  },
  flexiones: {
    id: 'x2',
    exercise_id: 'e2',
    exercise_name: 'Flexiones',
    measurement_type: 'reps_bodyweight' as const,
  },
  plancha: {
    id: 'x3',
    exercise_id: 'e3',
    exercise_name: 'Plancha',
    measurement_type: 'duration' as const,
  },
  correr: {
    id: 'x4',
    exercise_id: 'e4',
    exercise_name: 'Correr',
    measurement_type: 'distance_duration' as const,
  },
}

function seed(...names: Array<keyof typeof EXERCISES>): SessionDraft {
  return names.reduce<SessionDraft>(
    (draft, name) => editorReducer(draft, { type: 'addExercise', exercise: EXERCISES[name] }),
    emptyDraft(),
  )
}

function Harness({
  initial,
  indicator = 'saved',
  onAddExercise = () => {},
  onFinish = () => {},
  onRetry,
}: {
  initial: SessionDraft
  indicator?: EditorIndicator
  onAddExercise?: () => void
  onFinish?: () => void
  onRetry?: () => void
}) {
  const [draft, dispatch] = useReducer(editorReducer, initial)
  const built = useMemo(() => buildSessionPayload(draft), [draft])
  return (
    <SessionEditor
      draft={draft}
      dispatch={dispatch}
      errors={built.ok ? null : built.errors}
      indicator={indicator}
      onAddExercise={onAddExercise}
      onFinish={onFinish}
      onRetry={onRetry}
    />
  )
}

const card = (name: string) => screen.getByRole('article', { name })

describe('campos según el tipo de medición (FR-028, FR-029)', () => {
  it('cada tipo pide solo lo suyo, con su unidad visible', () => {
    render(<Harness initial={seed('press', 'flexiones', 'plancha', 'correr')} />)

    const press = within(card('Press'))
    expect(press.getByLabelText(e.fieldOfSet(t.fields.reps, 1))).toBeVisible()
    expect(press.getByLabelText(e.fieldOfSet(t.fields.weight_kg, 1))).toBeVisible()
    expect(press.queryByLabelText(e.fieldOfSet(t.fields.duration_s, 1))).toBeNull()

    const flexiones = within(card('Flexiones'))
    expect(flexiones.getByLabelText(e.fieldOfSet(t.fields.reps, 1))).toBeVisible()
    expect(flexiones.queryByLabelText(e.fieldOfSet(t.fields.weight_kg, 1))).toBeNull()

    const plancha = within(card('Plancha'))
    expect(plancha.getByLabelText(e.fieldOfSet(t.fields.duration_s, 1))).toBeVisible()
    expect(plancha.queryByLabelText(e.fieldOfSet(t.fields.reps, 1))).toBeNull()

    const correr = within(card('Correr'))
    expect(correr.getByLabelText(e.fieldOfSet(t.fields.distance_km, 1))).toBeVisible()
    expect(correr.getByLabelText(e.fieldOfSet(t.fields.duration_s, 1))).toBeVisible()
    expect(correr.queryByLabelText(e.fieldOfSet(t.fields.reps, 1))).toBeNull()
  })

  it('un dato sin completar se ve como «sin dato» (SC-007)', () => {
    render(<Harness initial={seed('press')} />)
    const weight = screen.getByLabelText(e.fieldOfSet(t.fields.weight_kg, 1))
    expect(weight).toHaveAttribute('placeholder', t.noData)
    expect(weight).toHaveValue('')
  })

  it('el peso 0 se acepta y las repeticiones se pueden escribir con coma en el peso', async () => {
    render(<Harness initial={seed('press')} />)
    await userEvent.type(screen.getByLabelText(e.fieldOfSet(t.fields.reps, 1)), '5')
    await userEvent.type(screen.getByLabelText(e.fieldOfSet(t.fields.weight_kg, 1)), '0')
    expect(screen.queryByRole('alert')).toBeNull()
    await userEvent.clear(screen.getByLabelText(e.fieldOfSet(t.fields.weight_kg, 1)))
    await userEvent.type(screen.getByLabelText(e.fieldOfSet(t.fields.weight_kg, 1)), '62,5')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('un valor fuera de rango muestra su mensaje junto al campo', async () => {
    render(<Harness initial={seed('press')} />)
    const reps = screen.getByLabelText(e.fieldOfSet(t.fields.reps, 1))
    await userEvent.type(reps, '1000')
    expect(reps).toHaveAttribute('aria-invalid', 'true')
    expect(within(card('Press')).getByText(t.validation.reps)).toBeVisible()
  })

  it('el tiempo se escribe como mm:ss', async () => {
    render(<Harness initial={seed('plancha')} />)
    const time = screen.getByLabelText(e.fieldOfSet(t.fields.duration_s, 1))
    await userEvent.type(time, '1:75')
    expect(within(card('Plancha')).getByText(t.validation.duration)).toBeVisible()
    await userEvent.clear(time)
    await userEvent.type(time, '1:30')
    expect(screen.queryByText(t.validation.duration)).toBeNull()
  })
})

describe('series (FR-033)', () => {
  it('agregar, copiar la anterior y quitar', async () => {
    render(<Harness initial={seed('press')} />)
    const press = within(card('Press'))
    await userEvent.type(press.getByLabelText(e.fieldOfSet(t.fields.reps, 1)), '8')
    await userEvent.type(press.getByLabelText(e.fieldOfSet(t.fields.weight_kg, 1)), '60')

    await userEvent.click(press.getByRole('button', { name: e.copySet }))
    expect(press.getByLabelText(e.fieldOfSet(t.fields.reps, 2))).toHaveValue('8')
    expect(press.getByLabelText(e.fieldOfSet(t.fields.weight_kg, 2))).toHaveValue('60')

    await userEvent.click(press.getByRole('button', { name: e.addSet }))
    expect(press.getByLabelText(e.fieldOfSet(t.fields.reps, 3))).toHaveValue('')

    await userEvent.click(press.getByRole('button', { name: e.removeSet(3) }))
    expect(press.queryByLabelText(e.fieldOfSet(t.fields.reps, 3))).toBeNull()
    expect(press.getByLabelText(e.fieldOfSet(t.fields.reps, 2))).toBeVisible()
  })

  it('reordenar las series con botones', async () => {
    render(<Harness initial={seed('flexiones')} />)
    const flexiones = within(card('Flexiones'))
    await userEvent.type(flexiones.getByLabelText(e.fieldOfSet(t.fields.reps, 1)), '10')
    await userEvent.click(flexiones.getByRole('button', { name: e.addSet }))
    await userEvent.type(flexiones.getByLabelText(e.fieldOfSet(t.fields.reps, 2)), '7')
    await userEvent.click(flexiones.getByRole('button', { name: e.moveSetUp(2) }))
    expect(flexiones.getByLabelText(e.fieldOfSet(t.fields.reps, 1))).toHaveValue('7')
    expect(flexiones.getByLabelText(e.fieldOfSet(t.fields.reps, 2))).toHaveValue('10')
  })

  it('quitar todas las series deja el ejercicio sin series', async () => {
    render(<Harness initial={seed('flexiones')} />)
    const flexiones = within(card('Flexiones'))
    await userEvent.click(flexiones.getByRole('button', { name: e.removeSet(1) }))
    expect(flexiones.getByText(e.noSetsYet)).toBeVisible()
  })
})

describe('esfuerzo percibido y notas (FR-014, FR-032)', () => {
  it('uno por ejercicio, de 1 a 10, o «sin indicar»', async () => {
    render(<Harness initial={seed('press', 'plancha')} />)
    const effort = within(card('Press')).getByLabelText(e.effortOfExercise('Press'))
    expect(effort).toHaveValue('')
    expect(within(effort).getByRole('option', { name: t.effort.none })).toBeInTheDocument()
    expect(within(effort).getAllByRole('option')).toHaveLength(11)
    await userEvent.selectOptions(effort, '7')
    expect(effort).toHaveValue('7')
    expect(within(card('Plancha')).getByLabelText(e.effortOfExercise('Plancha'))).toHaveValue('')
  })

  it('el selector explica los extremos de la escala', () => {
    render(<Harness initial={seed('press')} />)
    expect(within(card('Press')).getByText(t.effort.hint)).toBeVisible()
  })

  it('nota del ejercicio y nota de la sesión', async () => {
    render(<Harness initial={seed('press')} />)
    await userEvent.type(within(card('Press')).getByLabelText(e.exerciseNote), 'pesado')
    await userEvent.type(screen.getByLabelText(e.sessionNote), 'buena sesión')
    expect(within(card('Press')).getByLabelText(e.exerciseNote)).toHaveValue('pesado')
    expect(screen.getByLabelText(e.sessionNote)).toHaveValue('buena sesión')
  })
})

describe('ejercicios', () => {
  it('sin ejercicios invita a agregar uno', async () => {
    const onAddExercise = vi.fn()
    render(<Harness initial={emptyDraft()} onAddExercise={onAddExercise} />)
    expect(screen.getByText(e.noExercises)).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: e.addExercise }))
    expect(onAddExercise).toHaveBeenCalledTimes(1)
  })

  it('subir, bajar y quitar un ejercicio', async () => {
    render(<Harness initial={seed('press', 'plancha')} />)
    await userEvent.click(screen.getByRole('button', { name: e.moveExerciseUp('Plancha') }))
    const names = screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))
    expect(names).toEqual(['Plancha', 'Press'])
    await userEvent.click(screen.getByRole('button', { name: e.removeExercise('Plancha') }))
    expect(screen.queryByRole('article', { name: 'Plancha' })).toBeNull()
  })
})

describe('guardado y terminar (FR-046)', () => {
  it.each<[EditorIndicator, string]>([
    ['saved', t.saveIndicator.saved],
    ['saving', t.saveIndicator.saving],
    ['unsaved', t.saveIndicator.unsaved],
    ['offline', t.saveIndicator.offline],
    ['failed', t.saveIndicator.failed],
  ])('el indicador «%s» se anuncia', (indicator, text) => {
    render(<Harness initial={seed('press')} indicator={indicator} />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(text)
  })

  it('si no se guardó, ofrece reintentar', async () => {
    const onRetry = vi.fn()
    render(<Harness initial={seed('press')} indicator="offline" onRetry={onRetry} />)
    await userEvent.click(screen.getByRole('button', { name: e.retry }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('«Terminar sesión» llama a terminar', async () => {
    const onFinish = vi.fn()
    render(<Harness initial={seed('press')} onFinish={onFinish} />)
    await userEvent.click(screen.getByRole('button', { name: e.finish }))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('con valores inválidos avisa en lugar de terminar en silencio', async () => {
    const onFinish = vi.fn()
    render(<Harness initial={seed('press')} onFinish={onFinish} />)
    await userEvent.type(screen.getByLabelText(e.fieldOfSet(t.fields.reps, 1)), '0')
    expect(screen.getByRole('button', { name: e.finish })).toBeDisabled()
    expect(screen.getByText(e.fixErrors)).toBeVisible()
  })
})
