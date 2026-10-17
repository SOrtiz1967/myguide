import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { ErrorState } from '../../components/ErrorState'
import { Field } from '../../components/Field'
import { es } from '../../copy/es'
import { discardDraft } from '../../lib/drafts'
import { saveRemotely, WriteError } from '../../lib/mutation'
import { listTimezones } from '../../lib/timezone'
import { useDraft } from '../../lib/useDraft'
import type { Profile, ProfileUpdate } from './api'
import { toFormValues } from './profileValues'
import { profileDraftSchema, profileFormSchema, type ProfileFormInput } from './schema'
import { useUpdateProfile } from './useUpdateProfile'

const FORM_ID = 'profile'

interface ProfileFormProps {
  profile: Profile
  /** Se llama solo cuando el servidor confirmó el guardado. El mensaje lo muestra la pantalla, que no se vuelve a montar. */
  onConfirmed: () => void
  onSubmitStart: () => void
}

export function ProfileForm({ profile, onConfirmed, onSubmitStart }: ProfileFormProps) {
  // El borrador se elimina antes de que la pantalla se monte con el perfil confirmado (FR-021).
  const update = useUpdateProfile({ onSaved: () => discardDraft(profile.user_id, FORM_ID) })
  const draft = useDraft({ userId: profile.user_id, formId: FORM_ID, schema: profileDraftSchema })
  const saved = toFormValues(profile)

  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormInput, unknown, ProfileUpdate>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: draft.initial ?? saved,
  })

  // Cada cambio se guarda como borrador local; si vuelve a coincidir con lo guardado, no queda un
  // borrador obsoleto. Nunca incluye contraseñas (ver lib/drafts.ts).
  const values = useWatch({ control })
  const saveDraft = draft.save
  useEffect(() => {
    const current = profileDraftSchema.safeParse(values)
    if (!current.success) return
    if (JSON.stringify(current.data) === JSON.stringify(toFormValues(profile))) {
      discardDraft(profile.user_id, FORM_ID)
    } else {
      saveDraft(current.data)
    }
  }, [values, saveDraft, profile])

  // Si la zona guardada no figura en la lista (un alias), se agrega para no perderla.
  const timezones = useMemo(() => {
    const zones = listTimezones()
    return profile.timezone && !zones.includes(profile.timezone)
      ? [profile.timezone, ...zones]
      : zones
  }, [profile.timezone])

  const submit = handleSubmit(async (values) => {
    setError(null)
    onSubmitStart()
    try {
      await saveRemotely(() => update.mutateAsync(values))
      onConfirmed()
    } catch (e) {
      // FR-020: nada se muestra como guardado si no llegó al servidor; lo escrito y el borrador quedan.
      setError(e instanceof WriteError ? e.message : es.errors.generic)
    }
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{es.profile.formTitle}</h2>

      {draft.restored ? (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3"
        >
          <p>{es.profile.draftRestored}</p>
          <div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                reset(saved)
                draft.discard()
              }}
            >
              {es.profile.draftDiscard}
            </button>
          </div>
        </div>
      ) : null}

      <Field
        label={es.profile.labels.birthDate}
        type="date"
        autoComplete="bday"
        error={errors.birthDate?.message}
        {...register('birthDate')}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="perfil-sexo" className="font-medium">
          {es.profile.labels.sex}
        </label>
        <select
          id="perfil-sexo"
          className="min-h-11 rounded-md border border-line bg-surface px-3 py-2"
          aria-invalid={errors.sex ? true : undefined}
          {...register('sex')}
        >
          <option value="">{es.profile.sexOptions.unspecified}</option>
          <option value="female">{es.profile.sexOptions.female}</option>
          <option value="male">{es.profile.sexOptions.male}</option>
        </select>
        {errors.sex ? <p className="text-sm text-danger">{errors.sex.message}</p> : null}
      </div>

      <Field
        label={es.profile.labels.height}
        type="text"
        inputMode="decimal"
        error={errors.heightCm?.message}
        {...register('heightCm')}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="perfil-zona" className="font-medium">
          {es.profile.labels.timezone}
        </label>
        <select
          id="perfil-zona"
          className="min-h-11 rounded-md border border-line bg-surface px-3 py-2"
          aria-invalid={errors.timezone ? true : undefined}
          {...register('timezone')}
        >
          <option value="">{es.profile.chooseTimezone}</option>
          {timezones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
        {errors.timezone ? <p className="text-sm text-danger">{errors.timezone.message}</p> : null}
      </div>

      {error ? <ErrorState message={error} /> : null}

      <button type="submit" className="btn-primary" disabled={isSubmitting}>
        {es.profile.save}
      </button>
    </form>
  )
}
