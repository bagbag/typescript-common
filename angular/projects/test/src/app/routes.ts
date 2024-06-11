import type { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
  { path: 'icon', loadComponent: () => import('./examples/icon-example/icon-example.component').then((module) => module.IconExampleComponent) },
  { path: 'card', loadComponent: () => import('./examples/card/card.component') },
  { path: 'drawer-card', loadComponent: () => import('./examples/drawer-card-example/drawer-card-example.component').then((module) => module.DrawerCardExampleComponent) },
  { path: 'data-card', loadComponent: () => import('./examples/data-card-example/data-card-example.component') },
  { path: 'data-grid', loadComponent: () => import('./examples/data-grid/data-grid.component') },
  { path: 'vertical-tab-group', loadComponent: () => import('./examples/vertical-tab-group-example/vertical-tab-group-example.component').then((module) => module.VerticalTabGroupExampleComponent) },
  { path: 'react', loadComponent: () => import('./examples/react/react.component') },
  { path: 'markdown', loadComponent: () => import('./examples/markdown/markdown.component') },
  { path: 'misc', loadComponent: () => import('./examples/misc-examples/misc-examples.component').then((module) => module.MiscExamplesComponent) },
];

export default APP_ROUTES;
