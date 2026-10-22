import { Link } from 'react-router'
import { es } from '../../copy/es'
import { formatDate } from '../../lib/format'
import type { HistoryEntry } from './api'
import { effortLabel, setsCountLabel, summarizeSet } from './trainingText'

const h = es.training.history

/** Una vez que se hizo el ejercicio: fecha, series con unidades y esfuerzo percibido. Sin valoraciones. */
export function HistoryEntryView({ entry }: { entry: HistoryEntry }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="break-words font-medium">
        {formatDate(entry.session_date)} · {entry.exercise_name}
      </p>
      <p className="text-sm text-muted">{setsCountLabel(entry.sets.length)}</p>
      {entry.sets.length > 0 ? (
        <ol className="ml-5 list-decimal">
          {entry.sets.map((set, index) => (
            <li key={index}>{summarizeSet(entry.measurement_type, set)}</li>
          ))}
        </ol>
      ) : null}
      <p className="text-sm">
        {es.training.session.effort}: {effortLabel(entry.effort)}
      </p>
      {entry.note ? <p className="whitespace-pre-line break-words">{entry.note}</p> : null}
      <div>
        <Link to={`/entrenamiento/sesion/${entry.session_id}`} className="underline">
          {h.openSession}
          <span className="sr-only"> {h.sessionOf(formatDate(entry.session_date))}</span>
        </Link>
      </div>
    </div>
  )
}
