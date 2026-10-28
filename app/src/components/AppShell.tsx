import { useContext, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { es } from '../copy/es'
import { AuthContext } from '../features/auth/authContext'
import { NavIcon, type NavIconName } from './NavIcon'
import { OfflineNotice } from './OfflineNotice'

interface NavItem {
  to: string
  label: string
  icon?: NavIconName
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
  { to: '/medidas', label: es.measures.navLink, active: starts('/medidas') },
  { to: '/alimentos', label: es.foods.navLink, active: starts('/alimentos') },
  { to: '/ejercicios', label: es.exercises.navLink, active: starts('/ejercicios') },
  { to: '/actividad', label: es.activity.navLink, active: starts('/actividad') },
  {
    to: '/objetivo',
    label: es.nav.goal,
    active: (path) => path.startsWith('/objetivo') || path.startsWith('/plan'),
  },
  { to: '/perfil', label: es.nav.profile, active: starts('/perfil') },
]

function Brand() {
  return (
    <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-lg font-semibold">
      <span
        aria-hidden="true"
        className="grid size-7 place-items-center rounded-md bg-accent text-sm font-bold text-accent-ink"
      >
        M
      </span>
      {es.appName}
    </Link>
  )
}

/**
 * Estructura común: enlace para saltar al contenido y un único landmark `main`. Con sesión: menú lateral en
 * escritorio y barra inferior con «Más» en celular (spec 016). La carcasa no hace consultas: también se muestra sin
 * proveedor de datos (por ejemplo, sin conexión).
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
          className={`flex min-h-11 items-center gap-2 rounded-md px-2 py-1 text-sm ${
            variant === 'bar'
              ? 'max-lg:flex-col max-lg:justify-center max-lg:gap-0.5 max-lg:px-0.5 max-lg:text-[11px]'
              : ''
          } ${current ? 'bg-surface-2 font-semibold text-accent' : 'text-ink hover:bg-surface-2'}`}
        >
          {item.icon ? <NavIcon name={item.icon} /> : null}
          <span className="truncate">{item.label}</span>
        </Link>
      </li>
    )
  }

  return (
    <div
      className={`min-h-dvh bg-bg text-ink ${withMenu ? 'lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]' : ''}`}
    >
      <a href="#contenido" className="skip-link">
        {es.common.skipToContent}
      </a>
      <aside
        className={
          withMenu
            ? 'border-b border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-4'
            : 'border-b border-line bg-surface'
        }
      >
        <div
          className={`flex items-center justify-between gap-x-3 px-4 py-1 lg:px-0 ${
            withMenu ? '' : 'mx-auto max-w-3xl'
          }`}
        >
          <Brand />
          {signedIn && !withMenu ? (
            <button type="button" className="btn-secondary" onClick={() => void auth.signOut()}>
              {es.auth.actions.logout}
            </button>
          ) : null}
        </div>

        {withMenu ? (
          <nav
            aria-label={es.nav.label}
            className="max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-20 max-lg:border-t max-lg:border-line max-lg:bg-surface max-lg:pb-[env(safe-area-inset-bottom)] lg:mt-4 lg:flex lg:flex-1 lg:flex-col lg:gap-4"
          >
            <ul className="flex lg:flex-col lg:gap-1">
              {PRIMARY.map((item) => link(item, 'bar'))}
              <li className="min-w-0 flex-1 lg:hidden">
                <button
                  type="button"
                  aria-expanded={moreOpen}
                  aria-controls="menu-mas"
                  onClick={() => setOpenAt(moreOpen ? null : here)}
                  className="flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1 text-xs"
                >
                  <NavIcon name="more" />
                  <span>{es.nav.more}</span>
                </button>
              </li>
            </ul>
            <div
              id="menu-mas"
              className={`flex-col gap-1 border-line max-lg:fixed max-lg:inset-x-0 max-lg:bottom-16 max-lg:max-h-[70dvh] max-lg:overflow-y-auto max-lg:border-t max-lg:bg-surface max-lg:p-3 lg:flex lg:border-t lg:pt-4 ${
                moreOpen ? 'flex' : 'hidden'
              }`}
            >
              <ul className="flex flex-col gap-1">{SECONDARY.map((item) => link(item, 'side'))}</ul>
              <div className="mt-2">
                <button
                  type="button"
                  className="btn-secondary w-full"
                  onClick={() => void auth.signOut()}
                >
                  {es.auth.actions.logout}
                </button>
              </div>
            </div>
          </nav>
        ) : null}
      </aside>

      <div className="min-w-0">
        <OfflineNotice />
        <main
          id="contenido"
          className={`mx-auto px-4 py-6 ${withMenu ? 'max-w-6xl pb-28 lg:pb-8' : 'max-w-3xl'}`}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
