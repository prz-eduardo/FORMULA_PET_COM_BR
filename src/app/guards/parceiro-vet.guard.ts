import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ParceiroAuthService } from '../services/parceiro-auth.service';

@Injectable({ providedIn: 'root' })
export class parceiroVetGuard implements CanActivate {
  constructor(
    private router: Router,
    private parceiroAuth: ParceiroAuthService,
    private auth: AuthService
  ) {}

  async canActivate(): Promise<boolean | UrlTree> {
    if (!this.parceiroAuth.isLoggedIn()) {
      return this.router.parseUrl('/parceiros/login');
    }

    try {
      const response = await this.parceiroAuth.getVetSession();
      if (!response?.allowed || !response?.token) {
        return this.router.parseUrl('/parceiros/painel');
      }

      // Mantém compatibilidade com fluxos legados da área vet que usam AuthService/localStorage('token').
      this.auth.setToken(response.token);
      return true;
    } catch {
      return this.router.parseUrl('/parceiros/painel');
    }
  }
}
