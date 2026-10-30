import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { PageHeader } from '../../components/PageHeader'
import { es } from '../../copy/es'
import { MAX_PHOTOS } from './api'
import { ComparePanel } from './ComparePanel'
import { PhotoGallery } from './PhotoGallery'
import { PhotoViewer } from './PhotoViewer'
import { UploadForm } from './UploadForm'
import { usePhotoUrls, useProgressPhotos } from './useProgressPhotos'

const copy = es.progressPhotos

/**
 * Fotos de progreso (spec 019): subir, ver por fecha, corregir, eliminar y comparar de a dos. Las fotos elegidas viven
 * en la dirección (`?a=…&b=…`) para poder recargar o volver atrás sin perderlas; la foto abierta, solo en pantalla.
 */
export function ProgressPhotosPage() {
  const photosQuery = useProgressPhotos()
  const photos = photosQuery.data
  const urlsQuery = usePhotoUrls(photos)
  const [params, setParams] = useSearchParams()

  // Las fotos elegidas viven en la dirección para sobrevivir a una recarga, y en el estado para que la casilla responda
  // al instante (la dirección cambia de forma asíncrona y la casilla parpadearía).
  const [picked, setPicked] = useState<string[]>(() =>
    [params.get('a'), params.get('b')].filter((id): id is string => id !== null),
  )
  const known = new Set((photos ?? []).map((p) => p.id))
  // Solo valen los ids que existen: una foto eliminada sale sola de la comparación.
  const compareIds = picked.filter((id) => known.has(id))
  const openId = params.get('ver')
  const open = photos?.find((p) => p.id === openId) ?? null

  function update(next: { compare?: string[]; ver?: string | null }) {
    if (next.compare) setPicked(next.compare)
    setParams(
      (current) => {
        const search = new URLSearchParams(current)
        if (next.compare) {
          search.delete('a')
          search.delete('b')
          if (next.compare[0]) search.set('a', next.compare[0])
          if (next.compare[1]) search.set('b', next.compare[1])
        }
        if (next.ver !== undefined) {
          if (next.ver) search.set('ver', next.ver)
          else search.delete('ver')
        }
        return search
      },
      { replace: true },
    )
  }

  function toggleCompare(id: string) {
    if (compareIds.includes(id)) update({ compare: compareIds.filter((x) => x !== id) })
    else if (compareIds.length < 2) update({ compare: [...compareIds, id] })
  }

  const urls = urlsQuery.data
  const urlsFailed = urlsQuery.isError
  const chosen = compareIds
    .map((id) => photos?.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={copy.title} subtitle={copy.subtitle} />

      <UploadForm full={(photos?.length ?? 0) >= MAX_PHOTOS} />

      {photosQuery.isPending ? <LoadingState label={copy.list.loading} /> : null}
      {photosQuery.isError ? (
        <ErrorState message={copy.list.loadError} onRetry={() => void photosQuery.refetch()} />
      ) : null}

      {photos && photos.length === 0 ? (
        <EmptyState title={copy.list.emptyTitle} description={copy.list.emptyBody} />
      ) : null}

      {open ? (
        <PhotoViewer
          key={open.id}
          photo={open}
          url={urls?.[open.storage_path]}
          urlFailed={urlsFailed}
          onClose={() => update({ ver: null })}
        />
      ) : null}

      <ComparePanel
        photos={chosen}
        urls={urls}
        urlsFailed={urlsFailed}
        onClear={() => update({ compare: [] })}
      />

      {photos && photos.length > 0 ? (
        <section aria-labelledby="fotos-lista-titulo" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="fotos-lista-titulo" className="text-lg font-extrabold">
              {copy.list.title}
            </h2>
            <p className="text-sm text-muted">{copy.list.count(photos.length)}</p>
          </div>
          <PhotoGallery
            photos={photos}
            urls={urls}
            urlsFailed={urlsFailed}
            openId={open?.id ?? null}
            compareIds={compareIds}
            onOpen={(id) => update({ ver: id })}
            onToggleCompare={toggleCompare}
          />
        </section>
      ) : null}
    </div>
  )
}
