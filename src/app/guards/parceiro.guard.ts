import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ParceiroAuthService } from '../services/parceiro-auth.service';

export const parceiroGuard: CanActivateFn = () => {
  const auth = inject(ParceiroAuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  // Preserve attempted URL so login can redirect back
  const returnUrl = router.url || '/parceiros/painel';
  return router.parseUrl(`/parceiros/login?returnUrl=${encodeURIComponent(returnUrl)}`);
};
