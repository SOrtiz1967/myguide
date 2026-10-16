import { es } from '../copy/es'

interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3">
      <p className="text-danger">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn-secondary mt-3">
          {es.common.retry}
        </button>
      ) : null}
    </div>
  )
}
