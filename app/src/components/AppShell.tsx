import { useContext, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { es } from '../copy/es'
import { AuthContext } from '../features/auth/authContext'
import { NavIcon, type NavIconName } from './NavIcon'
import { OfflineNotice } from './OfflineNotice'

interface NavItem {
  to: string
  label: string
  icon: NavIconName
  active: (path: string, hash: string) => boolean
}

const starts = (prefix: string) => (path: string) => path.startsWith(prefix)

/** Los cuatro accesos de la barra inferior (celular) y el comienzo del menú lateral (escritorio). */
const PRIMARY: NavItem[] = [
  { to: '/', label: es.nav.home, icon: 'home', active: (path) => path === '/' },
  {
    to: '/entrenamiento#calendario',
    label: es.nav.calendar,
    icon: 'calendar',
    active: (path, hash) => path.startsWith('/entrenamiento') && hash === '#calendario',
  },
  {
    to: '/entrenamiento',
    label: es.training.navLink,
    icon: 'dumbbell',
    active: (path, hash) => path.startsWith('/entrenamiento') && hash !== '#calendario',
  },
  { to: '/comidas', label: es.meals.navLink, icon: 'meal', active: starts('/comidas') },
]

/** El resto: en celular se abre con «Más». */
const SECONDARY: NavItem[] = [
  { to: '/medidas', label: es.measures.navLink, icon: 'ruler', active: starts('/medidas') },
  { to: '/fotos', label: es.progressPhotos.navLink, icon: 'camera', active: starts('/fotos') },
  {
    to: '/suplementos',
    label: es.supplements.navLink,
    icon: 'pill',
    active: starts('/suplementos'),
  },
  { to: '/alimentos', label: es.foods.navLink, icon: 'food', active: starts('/alimentos') },
  { to: '/ejercicios', label: es.exercises.navLink, icon: 'bolt', active: starts('/ejercicios') },
  { to: '/actividad', label: es.activity.navLink, icon: 'steps', active: starts('/actividad') },
  {
    to: '/objetivo',
    label: es.nav.goal,
    icon: 'target',
    active: (path) => path.startsWith('/objetivo') || path.startsWith('/plan'),
  },
  { to: '/perfil', label: es.nav.profile, icon: 'user', active: starts('/perfil') },
  { to: '/privacidad', label: es.privacy.navLink, icon: 'shield', active: starts('/privacidad') },
]

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      className={`inline-flex min-h-11 items-center gap-2 text-lg font-extrabold ${
        compact ? 'lg:justify-center' : ''
      }`}
    >
      <span
        aria-hidden="true"
        className="grid size-9 place-items-center rounded-md bg-accent text-base font-extrabold text-accent-ink"
      >
        M
      </span>
      <span className={compact ? 'lg:sr-only' : undefined}>{es.appName}</span>
    </Link>
  )
}

/**
 * Estructura común: enlace para saltar al contenido y un único landmark `main`. Con sesión: columna de íconos
 * con su nombre en escritorio y barra inferior flotante con «Más» en celular (spec 017, dirección C). La carcasa
 * no hace consultas: también se muestra sin proveedor de datos (por ejemplo, sin conexión).
 */
export function AppShell({ children }: { children: ReactNode }) {
  // El contexto es opcional aquí: la carcasa también se muestra sin proveedor (por ejemplo, sin conexión).
  const auth = useContext(AuthContext)
  const { pathname, hash } = useLocation()
  // El menú «Más» queda abierto solo en la pantalla donde se abrió: al navegar se cierra sin efectos.
  const here = `${pathname}${hash}`
  const [openAt, setOpenAt] = useState<string | null>(null)
  const moreOpen = openAt === here

  const signedIn = auth?.status === 'signedIn'
  // Durante el primer ingreso el menú no ofrece enlaces que vuelvan a la bienvenida.
  const onboarding = pathname === '/bienvenida'
  const withMenu = signedIn && !onboarding

  const link = (item: NavItem, variant: 'bar' | 'side') => {
    const current = item.active(pathname, hash)
    return (
      <li key={item.to} className={variant === 'bar' ? 'min-w-0 flex-1 lg:flex-none' : undefined}>
        <Link
          to={item.to}
          aria-current={current ? 'page' : undefined}
          className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1.5 text-center text-[10px] leading-tight lg:px-1 lg:text-[11px] ${
            current
              ? 'bg-surface-2 font-bold text-ink'
              : 'text-muted hover:bg-surface-2 hover:text-ink'
          } ${variant === 'side' ? 'max-lg:flex-row max-lg:justify-start max-lg:gap-3 max-lg:px-3 max-lg:text-sm' : ''}`}
        >
          <NavIcon name={item.icon} />
          <span className="max-w-full [overflow-wrap:anywhere]">{item.label}</span>
        </Link>
      </li>
    )
  }

  return (
    <div
      className={`min-h-dvh bg-bg text-ink ${withMenu ? 'lg:grid lg:grid-cols-[6.75rem_minmax(0,1fr)]' : ''}`}
    >
      <a href="#contenido" className="skip-link">
        {es.common.skipToContent}
      </a>
      <aside
        className={
          withMenu
            ? 'lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:overflow-y-auto lg:px-2 lg:py-5'
            : ''
        }
      >
        <div
          className={`flex items-center justify-between gap-x-3 px-4 py-2 lg:px-0 ${
            withMenu ? '' : 'mx-auto max-w-3xl'
          }`}
        >
          <Brand compact={withMenu} />
          {signedIn && !withMenu ? (
            <button type="button" className="btn-secondary" onClick={() => void auth.signOut()}>
              {es.auth.actions.logout}
            </button>
          ) : null}
        </div>

        {withMenu ? (
          <nav
            aria-label={es.nav.label}
            className="max-lg:fixed max-lg:inset-x-3 max-lg:bottom-3 max-lg:z-20 max-lg:pb-[env(safe-area-inset-bottom)] lg:mt-3 lg:flex lg:flex-1 lg:flex-col lg:gap-3"
          >
            <ul className="flex gap-1 max-lg:rounded-full max-lg:bg-surface max-lg:p-1.5 max-lg:shadow-[0_8px_24px_rgb(0_0_0/0.5)] lg:flex-col">
              {PRIMARY.map((item) => link(item, 'bar'))}
              <li className="min-w-0 flex-1 lg:hidden">
                <button
                  type="button"
                  aria-expanded={moreOpen}
                  aria-controls="menu-mas"
                  onClick={() => setOpenAt(moreOpen ? null : here)}
                  className="flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] text-muted"
                >
                  <NavIcon name="more" />
                  <span>{es.nav.more}</span>
                </button>
              </li>
            </ul>
            <div
              id="menu-mas"
              className={`flex-col gap-2 max-lg:absolute max-lg:inset-x-0 max-lg:bottom-[4.75rem] max-lg:max-h-[65dvh] max-lg:overflow-y-auto max-lg:rounded-xl max-lg:bg-surface max-lg:p-3 max-lg:shadow-[0_8px_24px_rgb(0_0_0/0.5)] lg:flex lg:border-t lg:border-line/40 lg:pt-3 ${
                moreOpen ? 'flex' : 'hidden'
              }`}
            >
              <ul className="flex flex-col gap-1">{SECONDARY.map((item) => link(item, 'side'))}</ul>
              <button
                type="button"
                className="btn-quiet w-full text-sm lg:mt-2 lg:px-1"
                onClick={() => void auth.signOut()}
              >
                {es.auth.actions.logout}
              </button>
            </div>
          </nav>
        ) : null}
      </aside>

      <div className="min-w-0">
        <OfflineNotice />
        <main
          id="contenido"
          className={`mx-auto px-4 py-6 ${withMenu ? 'max-w-6xl pb-28 lg:px-8 lg:pb-8' : 'max-w-3xl'}`}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
