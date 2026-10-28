import { useState, type ReactNode } from 'react'
import { Card, type CardTone } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { Field } from '../components/Field'
import { LoadingState } from '../components/LoadingState'
import { Meter } from '../components/Meter'
import { PageHeader } from '../components/PageHeader'
import { StatusTag } from '../components/StatusTag'
import { SuccessMessage } from '../components/SuccessMessage'
import type { GlyphKind } from '../features/week/Glyph'

const COLORS: { token: string; use: string }[] = [
  { token: 'bg', use: 'Fondo de la aplicación' },
  { token: 'surface', use: 'Bloque base' },
  { token: 'surface-2', use: 'Elemento elevado o seleccionado' },
  { token: 'surface-3', use: 'Elemento inactivo' },
  { token: 'tone-calorie', use: 'Bloque de calorías y comidas' },
  { token: 'tone-training', use: 'Bloque de entrenamiento' },
  { token: 'tone-body', use: 'Bloque de peso y medidas' },
  { token: 'accent', use: 'Acción principal' },
]

const TONES: { tone: CardTone; name: string }[] = [
  { tone: 'base', name: 'Base' },
  { tone: 'calorie', name: 'Calorías' },
  { tone: 'training', name: 'Entrenamiento' },
  { tone: 'body', name: 'Cuerpo' },
]

const STATUSES: { kind: GlyphKind; text: string }[] = [
  { kind: 'in-range', text: 'En rango' },
  { kind: 'below', text: 'Por debajo' },
  { kind: 'above', text: 'Por encima' },
  { kind: 'in-progress', text: 'En curso' },
  { kind: 'no-record', text: 'Sin registro' },
  { kind: 'done', text: 'Hecho' },
  { kind: 'planned', text: 'Planificado' },
  { kind: 'unlogged', text: 'Sin registrar' },
]

function Piece({ title, when, children }: { title: string; when: string; children: ReactNode }) {
  return (
    <Card as="section" className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-bold">{title}</h2>
        <p className="text-sm text-muted">{when}</p>
      </div>
      {children}
    </Card>
  )
}

/**
 * Página de referencia del sistema de diseño (spec 017): cada pieza con sus estados y cuándo usarla. Es interna:
 * no muestra datos de la persona.
 */
export function DesignSystemPage() {
  const [selected, setSelected] = useState('todos')
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Sistema de diseño"
        subtitle="Las piezas con las que se arma cada pantalla de MyGuide."
      />

      <Piece title="Colores" when="Se usan siempre por su nombre, nunca como valor suelto.">
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {COLORS.map((color) => (
            <li key={color.token} className="card-inset flex flex-col gap-2">
              <span
                aria-hidden="true"
                className="h-10 rounded-md border border-line"
                style={{ background: `var(--color-${color.token})` }}
              />
              <span className="text-sm font-bold">{color.token}</span>
              <span className="text-xs text-muted">{color.use}</span>
            </li>
          ))}
        </ul>
      </Piece>

      <Piece
        title="Bloques"
        when="Un bloque por tema; el tono dice de qué trata, no si va bien o mal."
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {TONES.map(({ tone, name }) => (
            <Card key={tone} tone={tone} className="flex flex-col gap-2">
              <p className="text-sm font-bold">{name}</p>
              <p className="card-inset text-sm">Elemento interno</p>
            </Card>
          ))}
        </div>
      </Piece>

      <Piece
        title="Botones y filtros"
        when="Uno principal por pantalla; el resto, secundarios o discretos."
      >
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary">
            Principal
          </button>
          <button type="button" className="btn-secondary">
            Secundario
          </button>
          <button type="button" className="btn-quiet">
            Discreto
          </button>
          <button type="button" className="btn-primary" disabled>
            Deshabilitado
          </button>
        </div>
        <div role="group" aria-label="Ejemplo de filtros" className="flex flex-wrap gap-2">
          {['todos', 'genéricos', 'propios'].map((option) => (
            <button
              key={option}
              type="button"
              className="chip"
              aria-pressed={selected === option}
              onClick={() => setSelected(option)}
            >
              {option[0]?.toUpperCase()}
              {option.slice(1)}
            </button>
          ))}
        </div>
      </Piece>

      <Piece
        title="Campos"
        when="Siempre con etiqueta visible; la ayuda y el error se leen junto al campo."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Normal" hint="Texto de ayuda." defaultValue="Valor" />
          <Field label="Con error" error="Escribe un número válido." defaultValue="abc" />
          <Field label="Deshabilitado" disabled defaultValue="No editable" />
        </div>
      </Piece>

      <Piece
        title="Estados"
        when="Siempre con texto y una forma distinta; el color solo acompaña, y nunca es rojo o verde."
      >
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STATUSES.map((status) => (
            <li key={status.kind} className="card-inset">
              <StatusTag kind={status.kind}>{status.text}</StatusTag>
            </li>
          ))}
        </ul>
      </Piece>

      <Piece
        title="Barra de avance"
        when="Muestra lo registrado frente a una referencia; las cifras van en texto."
      >
        <Card tone="calorie">
          <Meter
            value={1680}
            goal={2600}
            low={2340}
            high={2860}
            caption="1.680 de 2.600 kcal · rango de referencia 2.340 a 2.860"
          />
        </Card>
      </Piece>

      <Piece
        title="Carga, vacío, error y confirmación"
        when="Mismos mensajes y acciones en todas las pantallas."
      >
        <LoadingState />
        <EmptyState
          title="Todavía no hay nada aquí"
          description="Cuando registres algo, aparecerá en este lugar."
          actionLabel="Agregar"
          onAction={() => undefined}
        />
        <ErrorState message="No pudimos cargar este bloque." onRetry={() => undefined} />
        <SuccessMessage>Guardado.</SuccessMessage>
      </Piece>
    </div>
  )
}
