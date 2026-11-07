import React from 'react';
import ReactDOM from 'react-dom/client';
import { createHashRouter, createMemoryRouter, RouterProvider } from 'react-router-dom';
import './styles/global.css';
import { StoreProvider } from './lib/store';
import { Shell } from './components/Shell';
import { Hoy } from './views/Hoy';
import { Prospectos } from './views/Prospectos';
import { Ficha } from './views/Ficha';
import { Pipeline } from './views/Pipeline';
import { Seguimientos } from './views/Seguimientos';
import { Borradores } from './views/Borradores';
import { Criterios } from './views/Criterios';
import { Ingresos } from './views/Ingresos';

// HashRouter: el build funciona abierto desde una carpeta local sin servidor.
// MemoryRouter: para el build de artifact (claude.ai no conserva rutas en el hash).
const create = import.meta.env.VITE_ROUTER === 'memory' ? createMemoryRouter : createHashRouter;
const router = create([
  {
    path: '/', element: <Shell />,
    children: [
      { index: true, element: <Hoy /> },
      { path: 'prospectos', element: <Prospectos /> },
      { path: 'prospectos/:id', element: <Ficha /> },
      { path: 'pipeline', element: <Pipeline /> },
      { path: 'seguimientos', element: <Seguimientos /> },
      { path: 'borradores', element: <Borradores /> },
      { path: 'criterios', element: <Criterios /> },
      { path: 'ingresos', element: <Ingresos /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoreProvider>
      <RouterProvider router={router} />
    </StoreProvider>
  </React.StrictMode>,
);
