import { Link } from 'react-router'
import { es } from '../../copy/es'
import { useDayStatus } from '../meals/useDayStatus'
import { useToday } from '../meals/useToday'
import { HomeSection } from './HomeSection'

const q = es.home.quick

/** Los cuatro accesos más usados. Son enlaces: llegan a la pantalla en un solo paso. */
export function QuickLinks() {
  const today = useToday()
  const status = useDayStatus()
  const date = status.data?.proposed_date ?? today
  const links = [
    { to: `/comidas/${date}/agregar`, label: q.meal },
    { to: '/entrenamiento', label: q.train },
    { to: '/entrenamiento#calendario', label: q.calendar },
    { to: '/perfil', label: q.profile },
  ]
  return (
    <HomeSection title={q.title}>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <li key={link.label}>
            <Link to={link.to} className="btn-secondary w-full">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </HomeSection>
  )
}
