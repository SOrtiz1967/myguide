import type { RouteObject } from 'react-router'
import { EmailConfirmedPage, EmailLinkInvalidPage } from '../features/auth/pages/EmailLinkPages'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { RecoverPage } from '../features/auth/pages/RecoverPage'
import { RegisterPage } from '../features/auth/pages/RegisterPage'
import { ResetPage } from '../features/auth/pages/ResetPage'
import { ProfilePage } from '../features/profile/ProfilePage'
import { AppLayout } from './AppLayout'
import { HomePage } from './HomePage'
import { Placeholder } from './Placeholder'
import { RequireAuth } from './RequireAuth'

/**
 * Tabla de rutas de contracts/ui-routes.md. Las rutas privadas pasan por RequireAuth (FR-012);
 * `/sin-conexion` es provisional hasta la historia 4.
 */
export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: '/registro', element: <RegisterPage /> },
      { path: '/ingresar', element: <LoginPage /> },
      { path: '/recuperar', element: <RecoverPage /> },
      { path: '/restablecer', element: <ResetPage /> },
      { path: '/correo-confirmado', element: <EmailConfirmedPage /> },
      { path: '/correo-no-valido', element: <EmailLinkInvalidPage /> },
      { path: '/sin-conexion', element: <Placeholder title="Sin conexión" /> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/perfil', element: <ProfilePage /> },
        ],
      },
    ],
  },
]
