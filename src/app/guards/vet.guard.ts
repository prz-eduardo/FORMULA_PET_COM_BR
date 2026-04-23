import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class vetGuard implements CanActivate {
  constructor(
    private router: Router,
    private auth: AuthService
  ) {}

  canActivate(): boolean | UrlTree {
    const token = this.auth.getToken();
    if (!token) {
      return this.router.parseUrl('/area-vet');
    }
    try {
      const decoded = jwtDecode<{ exp?: number; tipo?: string; role?: string }>(token);
      if (typeof decoded.exp === 'number') {
        const nowSec = Math.floor(Date.now() / 1000);
        if (decoded.exp < nowSec) {
          return this.router.parseUrl('/area-vet');
        }
      }
      const role = decoded.tipo || decoded.role;
      if (role !== 'vet') {
        return this.router.parseUrl('/area-vet');
      }
      return true;
    } catch {
      return this.router.parseUrl('/area-vet');
    }
  }
}
