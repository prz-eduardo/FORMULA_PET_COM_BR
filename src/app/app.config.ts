import { ApplicationConfig, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { accountBannedInterceptor } from './interceptors/account-banned.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled', // scrolla pro topo em novas navegações
        anchorScrolling: 'enabled'
      })
    ),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch(), withInterceptors([accountBannedInterceptor]))
  ]
};

