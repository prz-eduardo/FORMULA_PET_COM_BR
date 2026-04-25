import { Routes } from '@angular/router';

export const RASTREIO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./rastreio-shell.component').then((m) => m.RastreioShellComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/dashboard/activity-dashboard.component').then((m) => m.ActivityDashboardComponent),
        data: { title: 'Atividade — visão geral' },
      },
      {
        path: 'eventos',
        loadComponent: () => import('./pages/eventos/event-feed.component').then((m) => m.EventFeedComponent),
        data: { title: 'Atividade — eventos' },
      },
    ],
  },
];
