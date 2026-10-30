import { useState } from 'react'
import { es } from '../../copy/es'
import type { ProgressPhoto } from './api'
import { formatDay } from '../meals/meals'
import { poseLabel } from './photoText'

const copy = es.progressPhotos.list

interface PhotoImageProps {
  photo: ProgressPhoto
  /** El enlace firmado; vacío mientras carga. */
  url: string | undefined
  /** Si el lote de enlaces falló, la foto lo dice en vez de quedar en blanco. */
  failed?: boolean
  className?: string
  lazy?: boolean
}

/** Una foto con su texto alternativo neutral (fecha y pose) y sus estados de carga y de error. */
export function PhotoImage({
  photo,
  url,
  failed = false,
  className = '',
  lazy = true,
}: PhotoImageProps) {
  const [broken, setBroken] = useState(false)
  const box = `bg-surface-3 ${className}`
  const ratio = { aspectRatio: `${photo.width} / ${photo.height}` }

  if (failed || broken) {
    return (
      <span
        className={`${box} grid place-items-center p-3 text-center text-sm text-muted`}
        style={ratio}
      >
        {copy.imageError}
      </span>
    )
  }
  if (!url) {
    return (
      <span
        className={`${box} grid place-items-center p-3 text-center text-sm text-muted`}
        style={ratio}
      >
        {copy.imageLoading}
      </span>
    )
  }
  return (
    <img
      src={url}
      alt={copy.alt(formatDay(photo.taken_on), poseLabel(photo.pose).toLowerCase())}
      width={photo.width}
      height={photo.height}
      loading={lazy ? 'lazy' : undefined}
      onError={() => setBroken(true)}
      className={`${box} h-auto w-full object-cover`}
      style={ratio}
    />
  )
}
