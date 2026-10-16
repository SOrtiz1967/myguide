import { useId, type InputHTMLAttributes, type Ref } from 'react'

interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  error?: string
  ref?: Ref<HTMLInputElement>
}

export function CheckboxField({ label, error, id, ref, ...rest }: CheckboxFieldProps) {
  const generated = useId()
  const inputId = id ?? generated
  const errorId = error ? `${inputId}-error` : undefined

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-3">
        <input
          id={inputId}
          ref={ref}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className="mt-1 size-5"
          {...rest}
        />
        <label htmlFor={inputId}>{label}</label>
      </div>
      {error ? (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
