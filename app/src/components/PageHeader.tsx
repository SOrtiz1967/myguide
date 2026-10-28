import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Acción principal de la pantalla (por ejemplo un enlace «Agregar»). */
  action?: ReactNode
}

/** Encabezado común de pantalla: un único `h1`, subtítulo opcional y una acción a la derecha. */
export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="break-words text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}
