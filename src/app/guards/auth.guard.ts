import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { auth } from '../firebase-config';// importa o auth que criamos
import { onAuthStateChanged } from 'firebase/auth';

@Injectable({
  providedIn: 'root'
})
export class authGuard implements CanActivate {

  constructor(private router: Router) {}

  canActivate(): Promise<boolean> {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, (user) => {
        if (user) {
          resolve(true); // logado ✅
        } else {
          this.router.navigate(['/login']); // manda pro login 🚪
          resolve(false);
        }
      });
    });
  }
}
