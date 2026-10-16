import { useEffect, useRef } from 'react'
import { publicEnv } from '../../lib/supabase'

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'error-callback': () => void
      'expired-callback': () => void
    },
  ): string
  remove(widgetId: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const SCRIPT_ID = 'turnstile-script'

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID)
    const script = existing ?? document.createElement('script')
    script.addEventListener('load', () => resolve())
    script.addEventListener('error', () => reject(new Error('turnstile_script_failed')))
    if (!existing) {
      script.id = SCRIPT_ID
      ;(script as HTMLScriptElement).src = SCRIPT_SRC
      ;(script as HTMLScriptElement).async = true
      document.head.appendChild(script)
    }
  })
}

interface TurnstileWidgetProps {
  onToken: (token: string) => void
  /** El captcha no cargó o devolvió un error del servicio: la operación debe poder reintentarse. */
  onError?: () => void
}

/**
 * Captcha de Cloudflare. Se usa SOLO en registro y recuperación (FR-008); el inicio de sesión
 * nunca depende de este servicio externo (FR-025).
 */
export function TurnstileWidget({ onToken, onError }: TurnstileWidgetProps) {
  const container = useRef<HTMLDivElement>(null)
  const callbacks = useRef({ onToken, onError })
  // La referencia se actualiza en un efecto, no durante el renderizado.
  useEffect(() => {
    callbacks.current = { onToken, onError }
  })

  useEffect(() => {
    const siteKey = publicEnv.VITE_TURNSTILE_SITE_KEY
    if (!siteKey) {
      callbacks.current.onError?.()
      return
    }

    let widgetId: string | undefined
    let cancelled = false

    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return
        widgetId = window.turnstile.render(container.current, {
          sitekey: siteKey,
          callback: (token) => callbacks.current.onToken(token),
          'error-callback': () => callbacks.current.onError?.(),
          'expired-callback': () => callbacks.current.onToken(''),
        })
      })
      .catch(() => callbacks.current.onError?.())

    return () => {
      cancelled = true
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [])

  return <div ref={container} aria-label="Verificación de seguridad" />
}
