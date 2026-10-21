import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { z } from 'zod'
import { discardDraft } from '../../lib/drafts'
import { WriteError } from '../../lib/mutation'
import { useDraft } from '../../lib/useDraft'
import { StaleRevisionError, type SaveResult } from './api'
import { editorReducer, sameDraft } from './sessionEditorState'
import { buildSessionPayload, type SessionDraft, type SessionPayload } from './schema'

// Editor de una sesión (spec 006, FR-045 a FR-048; research.md Decisiones 4 y 5). Todo lo que se escribe queda en
// un borrador local hasta que el servidor confirma; mientras la sesión está en curso se guarda además en el
// servidor con un retardo corto, siempre con el estado más reciente y con una sola solicitud en vuelo. Nunca se
// presenta como «guardado» algo que el servidor no confirmó.

export type EditorIndicator = 'saved' | 'saving' | 'unsaved' | 'offline' | 'failed'

export type SaveOutcome =
  | { kind: 'ok'; result: SaveResult }
  | { kind: 'noop' }
  | { kind: 'invalid' }
  | { kind: 'conflict' }
  | { kind: 'error'; error?: unknown }

const setSchema = z.object({
  reps: z.string(),
  weight_kg: z.string(),
  duration: z.string(),
  distance_km: z.string(),
})

const exerciseSchema = z.object({
  id: z.string(),
  exercise_id: z.string().nullable(),
  exercise_name: z.string(),
  measurement_type: z.enum(['reps_weight', 'reps_bodyweight', 'duration', 'distance_duration']),
  plan_item_id: z.string().nullable(),
  is_substitute: z.boolean(),
  effort: z.string(),
  note: z.string(),
  sets: z.array(setSchema),
})

/** Lo que se guarda en el dispositivo: el borrador y la revisión del servidor sobre la que se hizo. */
const storedSchema = z.object({
  revision: z.number(),
  session: z.object({ note: z.string(), exercises: z.array(exerciseSchema) }),
})

export interface UseSessionEditorOptions {
  userId: string
  sessionId: string
  /** Lo guardado en el servidor al abrir la sesión. */
  initial: { revision: number; draft: SessionDraft }
  save: (payload: SessionPayload, expectedRevision: number, finish: boolean) => Promise<SaveResult>
  /** Vuelve a pedir la sesión al servidor (para resolver un conflicto). */
  loadServer: () => Promise<{ revision: number; draft: SessionDraft }>
  /** Falso en la corrección de una sesión realizada: solo se guarda a pedido. */
  autosave?: boolean
  debounceMs?: number
}

export function useSessionEditor({
  userId,
  sessionId,
  initial,
  save,
  loadServer,
  autosave = true,
  debounceMs = 1500,
}: UseSessionEditorOptions) {
  const stored = useDraft({ userId, formId: `workout-${sessionId}`, schema: storedSchema })

  // Qué mostrar al abrir: un borrador distinto de lo guardado se recupera; si se hizo sobre una revisión vieja,
  // otro dispositivo guardó después y hay que elegir qué versión conservar.
  const [start] = useState(() => {
    const local = stored.initial
    const differs = local !== null && !sameDraft(local.session, initial.draft)
    return {
      draft: differs ? local.session : initial.draft,
      restored: differs,
      conflict: differs && local.revision < initial.revision,
    }
  })

  const [draft, dispatch] = useReducer(editorReducer, start.draft)
  const [saved, setSaved] = useState<SessionDraft>(initial.draft)
  const [revision, setRevision] = useState(initial.revision)
  const [saving, setSaving] = useState(false)
  const [lastError, setLastError] = useState<'offline' | 'failed' | null>(null)
  const [conflict, setConflict] = useState(start.conflict)
  const [restored, setRestored] = useState(start.restored)

  const draftRef = useRef(draft)
  const savedRef = useRef(saved)
  const revisionRef = useRef(revision)
  const chain = useRef<Promise<unknown>>(Promise.resolve())

  // El último borrador, para que una solicitud que espera su turno envíe lo más reciente.
  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  const dirty = useMemo(() => !sameDraft(draft, saved), [draft, saved])
  const built = useMemo(() => buildSessionPayload(draft), [draft])

  // Borrador local en cada cambio; se borra cuando lo guardado coincide con lo escrito.
  const saveLocal = stored.save
  useEffect(() => {
    if (dirty) saveLocal({ revision: revisionRef.current, session: draft })
    else discardDraft(userId, `workout-${sessionId}`)
  }, [draft, dirty, saveLocal, userId, sessionId])

  /** Guarda el estado más reciente, de a una solicitud por vez (las demás esperan su turno). */
  const run = useCallback(
    (finish: boolean): Promise<SaveOutcome> => {
      const task = async (): Promise<SaveOutcome> => {
        const snapshot = draftRef.current
        if (!finish && sameDraft(snapshot, savedRef.current)) return { kind: 'noop' }
        const result = buildSessionPayload(snapshot)
        if (!result.ok) return { kind: 'invalid' }
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          setLastError('offline')
          return { kind: 'error' }
        }
        setSaving(true)
        setLastError(null)
        try {
          const response = await save(result.payload, revisionRef.current, finish)
          revisionRef.current = response.revision
          setRevision(response.revision)
          savedRef.current = snapshot
          setSaved(snapshot)
          setRestored(false)
          return { kind: 'ok', result: response }
        } catch (error) {
          if (error instanceof StaleRevisionError) {
            setConflict(true)
            return { kind: 'conflict' }
          }
          setLastError(error instanceof WriteError && error.network ? 'offline' : 'failed')
          return { kind: 'error', error }
        } finally {
          setSaving(false)
        }
      }
      const next = chain.current.then(task, task)
      chain.current = next.catch(() => undefined)
      return next
    },
    [save],
  )

  // Autoguardado con retardo.
  useEffect(() => {
    if (!autosave || conflict || !dirty) return
    const timer = setTimeout(() => void run(false), debounceMs)
    return () => clearTimeout(timer)
  }, [autosave, conflict, dirty, draft, debounceMs, run])

  // Al volver la conexión, se reintenta lo pendiente.
  useEffect(() => {
    if (!autosave) return
    const retryOnline = () => void run(false)
    window.addEventListener('online', retryOnline)
    return () => window.removeEventListener('online', retryOnline)
  }, [autosave, run])

  const adopt = useCallback(
    (server: { revision: number; draft: SessionDraft }, keepLocal: boolean) => {
      revisionRef.current = server.revision
      setRevision(server.revision)
      savedRef.current = server.draft
      setSaved(server.draft)
      if (!keepLocal) {
        dispatch({ type: 'replace', draft: server.draft })
        discardDraft(userId, `workout-${sessionId}`)
      }
      setConflict(false)
      setRestored(false)
      setLastError(null)
    },
    [userId, sessionId],
  )

  const resolveConflict = useCallback(
    async (choice: 'mine' | 'server') => {
      const server = await loadServer()
      adopt(server, choice === 'mine')
    },
    [loadServer, adopt],
  )

  const discardRestored = useCallback(() => adopt(initial, false), [adopt, initial])

  const indicator: EditorIndicator = saving
    ? 'saving'
    : !dirty
      ? 'saved'
      : conflict || lastError === 'failed'
        ? 'failed'
        : lastError === 'offline'
          ? 'offline'
          : 'unsaved'

  return {
    draft,
    dispatch,
    revision,
    indicator,
    /** El resultado de armar el payload: si falla, trae los errores por campo. */
    built,
    conflict,
    restored,
    discardRestored,
    resolveConflict,
    /** Reintenta el guardado pendiente. */
    retry: () => run(false),
    /** Guarda ahora (la corrección de una sesión realizada no tiene autoguardado). */
    saveNow: () => run(false),
    /** Guarda y termina la sesión. */
    finish: () => run(true),
  }
}
