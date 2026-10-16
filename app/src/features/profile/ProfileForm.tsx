import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { ErrorState } from '../../components/ErrorState'
import { Field } from '../../components/Field'
import { SuccessMessage } from '../../components/SuccessMessage'
import { es } from '../../copy/es'
import { isNetworkError, toUserMessage } from '../../lib/errors'
import { listTimezones } from '../../lib/timezone'
import type { Profile, ProfileUpdate } from './api'
import { toFormValues } from './profileValues'
import { profileFormSchema, type ProfileFormInput } from './schema'
import { useUpdateProfile } from './useUpdateProfile'

export function ProfileForm({ profile }: { profile: Profile }) {
  const update = useUpdateProfile()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormInput, unknown, ProfileUpdate>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: toFormValues(profile),
  })

  // Si la zona guardada no figura en la lista (un alias), se agrega para no perderla.
  const timezones = useMemo(() => {
    const zones = listTimezones()
    return profile.timezone && !zones.includes(profile.timezone)
      ? [profile.timezone, ...zones]
      : zones
  }, [profile.timezone])

  const submit = handleSubmit(async (values) => {
    setError(null)
    setSaved(false)
    try {
      await update.mutateAsync(values)
      setSaved(true)
    } catch (e) {
      // FR-020: nada se muestra como guardado si no llegó al servidor; lo escrito se conserva.
      setError(toUserMessage({ network: isNetworkError(e) }))
    }
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{es.profile.formTitle}</h2>

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
      {saved ? <SuccessMessage>{es.profile.saved}</SuccessMessage> : null}

      <button type="submit" className="btn-primary" disabled={isSubmitting}>
        {es.profile.save}
      </button>
    </form>
  )
}
