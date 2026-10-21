import type { RouteObject } from 'react-router'
import { EmailConfirmedPage, EmailLinkInvalidPage } from '../features/auth/pages/EmailLinkPages'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { RecoverPage } from '../features/auth/pages/RecoverPage'
import { RegisterPage } from '../features/auth/pages/RegisterPage'
import { ResetPage } from '../features/auth/pages/ResetPage'
import { ExerciseCreatePage } from '../features/exercises/ExerciseCreatePage'
import { ExerciseEditPage } from '../features/exercises/ExerciseEditPage'
import { ExerciseDetailPage } from '../features/exercises/ExerciseDetailPage'
import { ExerciseSearchPage } from '../features/exercises/ExerciseSearchPage'
import { FoodCreatePage } from '../features/foods/FoodCreatePage'
import { FoodDetailPage } from '../features/foods/FoodDetailPage'
import { FoodEditPage } from '../features/foods/FoodEditPage'
import { FoodSearchPage } from '../features/foods/FoodSearchPage'
import { SourcesPage } from '../features/foods/SourcesPage'
import { GoalPage } from '../features/goals/GoalPage'
import { AddEntryPage } from '../features/meals/AddEntryPage'
import { DayPage } from '../features/meals/DayPage'
import { EntryDetailPage } from '../features/meals/EntryDetailPage'
import { MealsRedirect } from '../features/meals/MealsRedirect'
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
          { path: '/comidas', element: <MealsRedirect /> },
          { path: '/comidas/:fecha', element: <DayPage /> },
          { path: '/comidas/:fecha/agregar', element: <AddEntryPage /> },
          { path: '/comidas/item/:id', element: <EntryDetailPage /> },
          { path: '/objetivo', element: <GoalPage /> },
          { path: '/alimentos', element: <FoodSearchPage /> },
          { path: '/alimentos/nuevo', element: <FoodCreatePage /> },
          { path: '/alimentos/:id', element: <FoodDetailPage /> },
          { path: '/alimentos/:id/editar', element: <FoodEditPage /> },
          { path: '/ejercicios', element: <ExerciseSearchPage /> },
          { path: '/ejercicios/nuevo', element: <ExerciseCreatePage /> },
          { path: '/ejercicios/:id', element: <ExerciseDetailPage /> },
          { path: '/ejercicios/:id/editar', element: <ExerciseEditPage /> },
          { path: '/fuentes', element: <SourcesPage /> },
        ],
      },
    ],
  },
]
