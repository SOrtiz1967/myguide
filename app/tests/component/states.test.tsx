// T014 (FR-023): cada pantalla tiene estados de carga, vacio, exito y error accesibles.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EmptyState } from '../../src/components/EmptyState'
import { ErrorState } from '../../src/components/ErrorState'
import { LoadingState } from '../../src/components/LoadingState'
import { SuccessMessage } from '../../src/components/SuccessMessage'

describe('estados de pantalla', () => {
  it('LoadingState se anuncia como estado de carga', () => {
    render(<LoadingState label="Cargando tu perfil" />)
    expect(screen.getByRole('status')).toHaveTextContent('Cargando tu perfil')
  })

  it('EmptyState explica que falta y ofrece una accion', async () => {
    const onAction = vi.fn()
    render(
      <EmptyState
        title="Todavia no completaste tu perfil"
        description="Necesitamos tu altura y tu fecha de nacimiento."
        actionLabel="Completar perfil"
        onAction={onAction}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Todavia no completaste tu perfil' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Completar perfil' }))
    expect(onAction).toHaveBeenCalledOnce()
  })

  it('SuccessMessage se anuncia sin interrumpir', () => {
    render(<SuccessMessage>Perfil guardado</SuccessMessage>)
    expect(screen.getByRole('status')).toHaveTextContent('Perfil guardado')
  })

  it('ErrorState se anuncia como alerta y permite reintentar', async () => {
    const onRetry = vi.fn()
    render(<ErrorState message="No pudimos cargar tus datos." onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar tus datos.')
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('ErrorState sin reintento no muestra boton', () => {
    render(<ErrorState message="Algo salio mal." />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
