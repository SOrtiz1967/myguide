import { es } from '../copy/es'

/** Pantalla de la carcasa sin conexión (FR-019): solo informa, no ofrece registrar ni consultar nada. */
export function OfflinePage({
  onReload = () => window.location.reload(),
}: {
  onReload?: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{es.offline.pageTitle}</h1>
      <p>{es.offline.pageBody}</p>
      <div>
        <button type="button" className="btn-primary" onClick={onReload}>
          {es.offline.reload}
        </button>
      </div>
    </div>
  )
}
