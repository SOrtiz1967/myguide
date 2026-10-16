import type { RouteObject } from 'react-router'
import { AppLayout } from './AppLayout'
import { Placeholder } from './Placeholder'

/**
 * Tabla de rutas de contracts/ui-routes.md. Las pantallas provisionales las reemplaza cada historia;
 * las rutas privadas se protegen con la guarda de la historia 2 (T049).
 */
export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Placeholder title="Inicio" /> },
      { path: '/perfil', element: <Placeholder title="Perfil" /> },
      { path: '/registro', element: <Placeholder title="Crear cuenta" /> },
      { path: '/ingresar', element: <Placeholder title="Ingresar" /> },
      { path: '/recuperar', element: <Placeholder title="Recuperar contraseña" /> },
      { path: '/restablecer', element: <Placeholder title="Nueva contraseña" /> },
      { path: '/correo-confirmado', element: <Placeholder title="Correo confirmado" /> },
      { path: '/correo-no-valido', element: <Placeholder title="Enlace no válido" /> },
      { path: '/sin-conexion', element: <Placeholder title="Sin conexión" /> },
    ],
  },
]
