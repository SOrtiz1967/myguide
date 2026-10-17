interface EmptyStateProps {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <section className="rounded-lg border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description ? <p className="mt-2 max-w-prose text-muted">{description}</p> : null}
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className="btn-primary mt-4">
          {actionLabel}
        </button>
      ) : null}
    </section>
  )
}
