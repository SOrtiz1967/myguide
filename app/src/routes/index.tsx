import type { RouteObject } from 'react-router'
import { EmailConfirmedPage, EmailLinkInvalidPage } from '../features/auth/pages/EmailLinkPages'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { RecoverPage } from '../features/auth/pages/RecoverPage'
import { RegisterPage } from '../features/auth/pages/RegisterPage'
import { ResetPage } from '../features/auth/pages/ResetPage'
import { FoodDetailPage } from '../features/foods/FoodDetailPage'
import { FoodSearchPage } from '../features/foods/FoodSearchPage'
import { FoodsPlaceholderPage } from '../features/foods/pages/FoodsPlaceholderPage'
import { ProfilePage } from '../features/profile/ProfilePage'
import { AppLayout } from './AppLayout'
import { HomePage } from './HomePage'
import { OfflinePage } from './OfflinePage'
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
      { path: '/sin-conexion', element: <OfflinePage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/perfil', element: <ProfilePage /> },
          { path: '/alimentos', element: <FoodSearchPage /> },
          { path: '/alimentos/nuevo', element: <FoodsPlaceholderPage /> },
          { path: '/alimentos/:id', element: <FoodDetailPage /> },
          { path: '/alimentos/:id/editar', element: <FoodsPlaceholderPage /> },
          { path: '/fuentes', element: <FoodsPlaceholderPage /> },
        ],
      },
    ],
  },
]
