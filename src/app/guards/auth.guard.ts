import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { SessionService } from '../services/session.service';

@Injectable({
  providedIn: 'root'
})
export class authGuard implements CanActivate {
  constructor(private router: Router, private session: SessionService) {}

  canActivate(): boolean | UrlTree {
    // For admin routes we require a valid backend token with role=admin
    const ok = this.session.hasValidSession(true);
    if (ok) return true;
    return this.router.parseUrl('/restrito/login');
  }
}
