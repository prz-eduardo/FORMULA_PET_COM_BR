import { isPlatformBrowser } from '@angular/common';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject, Injector, PLATFORM_ID } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { BannedUserModalService } from '../services/banned-user-modal.service';
import { isAccountBannedHttpError } from '../utils/account-ban.util';

/** Resposta 403 com code account_banned: limpa sessão e abre modal global (lazy DI evita ciclo com HttpClient). */
export const accountBannedInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);
  const platformId = inject(PLATFORM_ID);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (
        isPlatformBrowser(platformId) &&
        err instanceof HttpErrorResponse &&
        isAccountBannedHttpError(err)
      ) {
        const ban = injector.get(BannedUserModalService);
        void Promise.resolve().then(() => ban.presentAfterBannedLogin());
      }
      return throwError(() => err);
    })
  );
};
