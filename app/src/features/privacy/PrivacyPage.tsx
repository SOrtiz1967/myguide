import { es } from '../../copy/es'
import { DeleteAccountSection } from './DeleteAccountSection'
import { ExportSection } from './ExportSection'

const copy = es.privacy.summary

/** «Tus datos» (spec 011): qué se guarda y con quién, cuánto se conserva, y cómo descargar o eliminar todo. */
export function PrivacyPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">{es.privacy.title}</h1>
        <p className="text-muted">{es.privacy.intro}</p>
      </header>

      <section aria-labelledby="resumen-privacidad" className="card flex flex-col gap-4">
        <h2 id="resumen-privacidad" className="text-base font-bold">
          {copy.title}
        </h2>
        <p>{copy.stored}</p>

        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">{copy.servicesTitle}</h3>
          <ul className="list-disc space-y-1 pl-5">
            {copy.services.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">{copy.retentionTitle}</h3>
          <ul className="list-disc space-y-1 pl-5">
            {copy.retention.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-muted">{copy.notMedical}</p>
      </section>

      <ExportSection />
      <DeleteAccountSection />
    </div>
  )
}
