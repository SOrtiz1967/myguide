import { useId } from 'react'

interface Option {
  value: string
  label: string
  description?: string
}

interface ChoiceGroupProps {
  legend: string
  hint?: string
  options: readonly Option[]
  value: string
  onChange: (value: string) => void
  error?: string
  name: string
}

/** Opciones excluyentes: grupo de radios con leyenda, ayuda y error vinculados (FR-009). */
export function ChoiceGroup({
  legend,
  hint,
  options,
  value,
  onChange,
  error,
  name,
}: ChoiceGroupProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
    >
      <legend className="font-medium">{legend}</legend>
      {hint ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {options.map((option) => (
        <label
          key={option.value}
          className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-md border px-3 py-2 ${
            value === option.value ? 'border-accent bg-surface' : 'border-line bg-surface'
          }`}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            aria-invalid={error ? true : undefined}
            className="mt-1 size-4 accent-[var(--color-accent)]"
          />
          <span className="flex flex-col">
            <span className="font-medium">{option.label}</span>
            {option.description ? (
              <span className="text-sm text-muted">{option.description}</span>
            ) : null}
          </span>
        </label>
      ))}
      {error ? (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}
