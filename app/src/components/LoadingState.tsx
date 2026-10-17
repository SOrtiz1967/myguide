import { es } from '../copy/es'

export function LoadingState({ label = es.common.loading }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-8 text-muted">
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
      />
      <span>{label}</span>
    </div>
  )
}
