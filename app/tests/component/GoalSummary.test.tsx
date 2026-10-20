// T020 (spec 004, FR-002, SC-009): la tarjeta "Objetivo del día", variante sin objetivo.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../src/copy/es'
import { fetchGoalHistory } from '../../src/features/goals/api'
import type { GoalChange } from '../../src/features/goals/goalHistory'
import { GoalSummary } from '../../src/features/goals/GoalSummary'
import { findForbidden } from '../support/forbiddenTerms'
import type { SummaryEntry } from '../../src/features/goals/daySummary'

vi.mock('../../src/features/goals/api', () => ({ fetchGoalHistory: vi.fn(), saveGoal: vi.fn() }))
const mockedHistory = vi.mocked(fetchGoalHistory)
const g = es.goal

const item = (
  energy_kcal: number | null,
  status: 'confirmed' | 'pending' = 'confirmed',
): SummaryEntry => ({
  energy_kcal,
  status,
})
const change = (effective_from: string, kcal: number | null, created_at: string): GoalChange => ({
  effective_from,
  kcal,
  created_at,
})

function renderCard(props: { date?: string; today?: string; entries?: SummaryEntry[] } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <GoalSummary
          date={props.date ?? '2026-10-19'}
          today={props.today ?? '2026-10-19'}
          entries={props.entries ?? [item(1000), item(350)]}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockedHistory.mockReset().mockResolvedValue([])
})

/** Nada del objetivo: ni restantes, ni porcentaje, ni barra, ni vacíos ni en cero (FR-002, SC-009). */
function expectNoGoalElements(container: HTMLElement) {
  expect(screen.queryByText(/restan/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  expect(screen.queryByText(/objetivo:/i)).not.toBeInTheDocument()
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  expect(container.querySelector('[data-goal-bar]')).toBeNull()
  expect(screen.queryByText(g.change)).not.toBeInTheDocument()
  expect(screen.queryByText(g.howTitle)).not.toBeInTheDocument()
}

describe('GoalSummary sin objetivo', () => {
  it('muestra solo lo registrado, con la invitación opcional a fijar un objetivo hoy', async () => {
    const { container } = renderCard()
    expect(await screen.findByText(g.registered(1350, false))).toBeVisible()
    const section = screen.getByRole('region', { name: g.cardTitle })
    expect(section).toBeVisible()
    const invite = screen.getByRole('link', { name: g.invite })
    expect(invite).toHaveAttribute('href', '/objetivo?volver=2026-10-19')
    expectNoGoalElements(container)
  })

  it('una fecha futura también invita', async () => {
    renderCard({ date: '2026-10-22' })
    expect(await screen.findByRole('link', { name: g.invite })).toHaveAttribute(
      'href',
      '/objetivo?volver=2026-10-22',
    )
  })

  it('un día pasado muestra solo lo registrado, sin invitación', async () => {
    const { container } = renderCard({ date: '2026-10-18' })
    expect(await screen.findByText(g.registered(1350, false))).toBeVisible()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expectNoGoalElements(container)
  })

  it('un objetivo que empieza después de ese día no cuenta: sigue sin objetivo', async () => {
    mockedHistory.mockResolvedValue([change('2026-10-19', 2000, '2026-10-19T09:00:00Z')])
    const { container } = renderCard({ date: '2026-10-18' })
    expect(await screen.findByText(g.registered(1350, false))).toBeVisible()
    expectNoGoalElements(container)
  })

  it('un día quitado el objetivo no muestra nada del objetivo', async () => {
    mockedHistory.mockResolvedValue([
      change('2026-10-01', 2000, '2026-10-01T09:00:00Z'),
      change('2026-10-15', null, '2026-10-15T09:00:00Z'),
    ])
    const { container } = renderCard()
    expect(await screen.findByText(g.registered(1350, false))).toBeVisible()
    expectNoGoalElements(container)
  })

  it('mientras carga el historial no muestra la invitación ni lo registrado como si no hubiera objetivo', () => {
    mockedHistory.mockReturnValue(new Promise(() => {}))
    renderCard()
    expect(screen.getByText(g.page.loading)).toBeVisible()
    expect(screen.queryByRole('link', { name: g.invite })).not.toBeInTheDocument()
    expect(screen.queryByText(g.registered(1350, false))).not.toBeInTheDocument()
  })

  it('si falla el historial lo dice y permite reintentar, sin mostrar cifras del objetivo', async () => {
    mockedHistory.mockRejectedValueOnce(new Error('boom'))
    renderCard()
    expect(await screen.findByText(g.loadError)).toBeVisible()
    expect(screen.getByRole('button', { name: es.common.retry })).toBeVisible()
    expect(screen.queryByText(/restan/i)).not.toBeInTheDocument()
  })
})

// T027 (spec 004, FR-012, FR-013, FR-021): la tarjeta con objetivo, estados "under" y "met".
const TWO_THOUSAND = [change('2026-10-01', 2000, '2026-10-01T09:00:00Z')]

describe('GoalSummary con objetivo', () => {
  beforeEach(() => {
    mockedHistory.mockResolvedValue(TWO_THOUSAND)
  })

  it('muestra objetivo, registrado, restantes, la cuenta y el avance como texto', async () => {
    renderCard()
    const card = await screen.findByRole('region', { name: g.cardTitle })
    expect(await screen.findByText(g.goalLine(2000))).toBeVisible()
    expect(screen.getByText(g.registered(1350, false))).toBeVisible()
    expect(screen.getByText('Restan 650 kcal')).toBeVisible()
    expect(screen.getByText('2.000 − 1.350 = 650 kcal')).toBeVisible()
    expect(screen.getByText('68 % del objetivo')).toBeVisible()
    expect(card).not.toHaveTextContent(g.invite)
  })

  it('la barra mide el avance, es decorativa y no es un progressbar', async () => {
    const { container } = renderCard()
    await screen.findByText(g.goalLine(2000))
    const bar = container.querySelector<HTMLElement>('[data-goal-bar]')!
    expect(bar).not.toBeNull()
    expect(bar.style.width).toBe('68%')
    expect(bar.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('un día vacío con objetivo: 0 registradas y el objetivo completo como restante, sin tono de fallo', async () => {
    const { container } = renderCard({ entries: [] })
    expect(await screen.findByText(g.registered(0, false))).toBeVisible()
    expect(screen.getByText('Restan 2.000 kcal')).toBeVisible()
    expect(screen.getByText('2.000 − 0 = 2.000 kcal')).toBeVisible()
    expect(screen.getByText('0 % del objetivo')).toBeVisible()
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.querySelector('[data-goal-bar]')!.getAttribute('style')).toContain('0%')
  })

  it('exactamente el objetivo: restan 0 kcal y no hay frase de exceso', async () => {
    renderCard({ entries: [item(2000)] })
    expect(
      await screen.findByText('Restan 0 kcal. Lo registrado coincide con el objetivo.'),
    ).toBeVisible()
    expect(screen.getByText('2.000 − 2.000 = 0 kcal')).toBeVisible()
    expect(screen.getByText('100 % del objetivo')).toBeVisible()
    expect(screen.queryByText(/más que el objetivo/)).not.toBeInTheDocument()
  })

  it('«Cambiar objetivo» lleva a /objetivo y vuelve al día que se está viendo', async () => {
    renderCard({ date: '2026-10-18' })
    expect(await screen.findByRole('link', { name: g.change })).toHaveAttribute(
      'href',
      '/objetivo?volver=2026-10-18',
    )
  })

  it('cada día usa el objetivo que regía ese día', async () => {
    mockedHistory.mockResolvedValue([
      change('2026-10-01', 2000, '2026-10-01T09:00:00Z'),
      change('2026-10-19', 1800, '2026-10-19T09:00:00Z'),
    ])
    const hoy = renderCard({ date: '2026-10-19' })
    expect(await screen.findByText(g.goalLine(1800))).toBeVisible()
    hoy.unmount()
    renderCard({ date: '2026-10-18' })
    expect(await screen.findByText(g.goalLine(2000))).toBeVisible()
  })
})

// T031 (spec 004, FR-015 a FR-018): qué tan firme es la cifra.
describe('GoalSummary: aclaraciones de incertidumbre', () => {
  beforeEach(() => {
    mockedHistory.mockResolvedValue(TWO_THOUSAND)
  })

  it('ítems sin dato de energía: el restante es un máximo y se dice cuántos faltan', async () => {
    renderCard({ entries: [item(1350), item(null), item(null)] })
    expect(await screen.findByText('Restan como máximo 650 kcal')).toBeVisible()
    expect(screen.getByText(g.missingNote(2))).toBeVisible()
    expect(screen.getByText(g.registered(1350, true))).toBeVisible()
    expect(screen.queryByText('Restan 650 kcal')).not.toBeInTheDocument()
  })

  it('un solo ítem sin dato usa el singular', async () => {
    renderCard({ entries: [item(1350), item(null)] })
    expect(await screen.findByText('1 ítem no tiene dato de energía y no suma.')).toBeVisible()
  })

  it('exactamente el objetivo con ítems sin dato: restan como máximo 0 kcal', async () => {
    renderCard({ entries: [item(2000), item(null)] })
    expect(await screen.findByText('Restan como máximo 0 kcal')).toBeVisible()
    expect(screen.getByText(g.missingNote(1))).toBeVisible()
    expect(screen.queryByText(/coincide con el objetivo/)).not.toBeInTheDocument()
  })

  it('estimados sin confirmar: entran en lo registrado y se muestran aparte', async () => {
    renderCard({ entries: [item(1000), item(300, 'pending')] })
    expect(await screen.findByText('Restan 700 kcal')).toBeVisible()
    expect(
      screen.getByText(
        'Incluye 300 kcal estimadas que todavía no confirmaste. Lo que resta depende de esa estimación.',
      ),
    ).toBeVisible()
  })

  it('sin objetivo y con ítems sin dato: "al menos", sin restantes', async () => {
    mockedHistory.mockResolvedValue([])
    renderCard({ entries: [item(1350), item(null), item(null)] })
    expect(await screen.findByText('Registrado: al menos 1.350 kcal')).toBeVisible()
    expect(screen.getByText(g.missingNote(2))).toBeVisible()
    expect(screen.queryByText(/restan/i)).not.toBeInTheDocument()
  })

  it('sin objetivo y con estimados: los muestra aparte sin hablar de lo que resta', async () => {
    mockedHistory.mockResolvedValue([])
    renderCard({ entries: [item(1000), item(300, 'pending')] })
    expect(await screen.findByText(g.pendingNote(300, false))).toBeVisible()
    expect(screen.queryByText(/lo que resta/i)).not.toBeInTheDocument()
  })

  it('todos con energía y confirmados: ninguna aclaración (FR-017)', async () => {
    renderCard({ entries: [item(1000), item(350), item(0)] })
    expect(await screen.findByText('Restan 650 kcal')).toBeVisible()
    const card = screen.getByRole('region', { name: g.cardTitle })
    expect(card).not.toHaveTextContent(/no tiene|no tienen|como máximo|al menos|estimadas/)
  })

  it('un ítem con energía 0 es dato, no un faltante', async () => {
    renderCard({ entries: [item(0), item(1350)] })
    expect(await screen.findByText('Restan 650 kcal')).toBeVisible()
    expect(screen.queryByText(/ítems? no tienen? dato de energía/)).not.toBeInTheDocument()
  })

  it('«Cómo se calcula» se abre con el teclado y explica la fórmula, lo incluido y lo excluido', async () => {
    renderCard()
    const summary = await screen.findByText(g.howTitle)
    const details = summary.closest('details')!
    expect(details).not.toHaveAttribute('open')
    // es un <summary> nativo: se enfoca con el teclado y lo abre Enter o Espacio (se verifica en el
    // navegador, a11y-goals); jsdom solo emula el clic
    summary.focus()
    expect(summary).toHaveFocus()
    await userEvent.click(summary)
    expect(details).toHaveAttribute('open')
    for (const line of g.how) expect(screen.getByText(line)).toBeVisible()
  })
})

// T034 (spec 004, FR-019, FR-020, FR-022, SC-005): al superar el objetivo solo se informa.
describe('GoalSummary: objetivo superado', () => {
  beforeEach(() => {
    mockedHistory.mockResolvedValue(TWO_THOUSAND)
  })

  it('informa la diferencia con una frase factual y la cuenta', async () => {
    renderCard({ entries: [item(2250)] })
    expect(
      await screen.findByText('Registraste 250 kcal más que el objetivo de este día.'),
    ).toBeVisible()
    expect(screen.getByText('2.250 − 2.000 = 250 kcal')).toBeVisible()
    expect(screen.getByText('113 % del objetivo')).toBeVisible()
    expect(screen.queryByText(/^Restan (como|\d)/)).not.toBeInTheDocument()
  })

  it('con ítems sin dato de energía dice "al menos"', async () => {
    renderCard({ entries: [item(2250), item(null)] })
    expect(
      await screen.findByText('Registraste al menos 250 kcal más que el objetivo de este día.'),
    ).toBeVisible()
    expect(screen.getByText(g.missingNote(1))).toBeVisible()
  })

  it('la barra llega al 100 % y es idéntica a la de antes de superar el objetivo', async () => {
    const under = renderCard({ entries: [item(1900)] })
    await screen.findByText('Restan 100 kcal')
    const underBar = under.container.querySelector<HTMLElement>('[data-goal-bar]')!
    const underClasses = underBar.className
    const underParent = underBar.parentElement!.className
    under.unmount()

    const over = renderCard({ entries: [item(3000)] })
    await screen.findByText(/más que el objetivo/)
    const bar = over.container.querySelector<HTMLElement>('[data-goal-bar]')!
    expect(bar.style.width).toBe('100%')
    expect(bar.className).toBe(underClasses)
    expect(bar.parentElement!.className).toBe(underParent)
  })

  it('sin estilo de alarma: ni color de error, ni alerta, ni íconos', async () => {
    const { container } = renderCard({ entries: [item(2250)] })
    const phrase = await screen.findByText(/más que el objetivo/)
    expect(container.innerHTML).not.toMatch(/danger|warning|amber|red-/)
    expect(container.querySelector('[role="alert"], [role="alertdialog"]')).toBeNull()
    expect(container.querySelector('svg, img')).toBeNull()
    // la frase del exceso tiene el mismo estilo que la de "Restan…"
    const under = renderCard({ entries: [item(1000)] })
    const restan = await within(under.container).findByText(/^Restan \d/)
    expect(phrase.className).toBe(restan.className)
  })

  it('no hay rachas, puntajes, insignias ni comparaciones', async () => {
    const { container } = renderCard({ entries: [item(5000)] })
    await screen.findByText(/más que el objetivo/)
    expect(container.textContent).not.toMatch(
      /racha|puntaje|insignia|logro|otras personas|comparad/i,
    )
  })

  it('SC-005: ningún texto de la tarjeta, en ningún estado, contiene un término prohibido', async () => {
    const scenarios: Array<[string, SummaryEntry[], GoalChange[]]> = [
      ['sin objetivo', [item(1350), item(null)], []],
      ['por debajo', [item(1350)], TWO_THOUSAND],
      ['exacto', [item(2000)], TWO_THOUSAND],
      ['superado', [item(2250)], TWO_THOUSAND],
      ['superado con faltantes', [item(2250), item(null), item(null)], TWO_THOUSAND],
      ['con estimados', [item(1000), item(500, 'pending')], TWO_THOUSAND],
      ['objetivo bajo', [item(900)], [change('2026-10-01', 1100, '2026-10-01T09:00:00Z')]],
    ]
    for (const [label, entries, history] of scenarios) {
      mockedHistory.mockResolvedValue(history)
      const view = renderCard({ entries })
      const card = await screen.findByRole('region', { name: g.cardTitle })
      await screen.findByText(/^Registrado:/)
      expect({ label, found: findForbidden(card.textContent ?? '') }).toEqual({ label, found: [] })
      view.unmount()
    }
  })
})

// T035 (spec 004, FR-005): nota informativa para objetivos menores a 1.200 kcal.
describe('GoalSummary: nota informativa', () => {
  it('con un objetivo de 1.100 kcal se muestra la nota, sin color ni ícono de advertencia', async () => {
    mockedHistory.mockResolvedValue([change('2026-10-01', 1100, '2026-10-01T09:00:00Z')])
    const { container } = renderCard({ entries: [item(500)] })
    const note = await screen.findByText(g.lowGoalNote)
    expect(note).toBeVisible()
    expect(note.closest('[role="alert"]')).toBeNull()
    expect(container.querySelector('svg, img')).toBeNull()
    expect(note.className).not.toMatch(/danger|warning/)
  })

  it.each([1200, 2000])('con %i kcal no aparece', async (kcal) => {
    mockedHistory.mockResolvedValue([change('2026-10-01', kcal, '2026-10-01T09:00:00Z')])
    renderCard({ entries: [item(500)] })
    await screen.findByText(g.goalLine(kcal))
    expect(screen.queryByText(g.lowGoalNote)).not.toBeInTheDocument()
  })

  it('sin objetivo no aparece', async () => {
    renderCard()
    await screen.findByText(g.registered(1350, false))
    expect(screen.queryByText(g.lowGoalNote)).not.toBeInTheDocument()
  })
})
