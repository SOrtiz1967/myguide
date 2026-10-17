import { Link } from 'react-router'
import { es } from '../../../copy/es'

export function EmailConfirmedPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{es.auth.titles.emailConfirmed}</h1>
      <p>{es.auth.emailConfirmedBody}</p>
      <p>
        <Link to="/" className="btn-primary">
          {es.auth.goToStart}
        </Link>
      </p>
    </div>
  )
}

export function EmailLinkInvalidPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{es.auth.titles.linkInvalid}</h1>
      <p>{es.auth.linkInvalidBody}</p>
      <p>
        <Link to="/" className="btn-primary">
          {es.auth.goToStart}
        </Link>
      </p>
    </div>
  )
}
