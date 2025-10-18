import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../../../firebase-config';
import { SessionService } from '../../../services/session.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  error: string = '';
  loading = false;
  blocked = false;
  countdown = 6;

  constructor(private router: Router, private session: SessionService) {}

  loginWithGoogle() {
    this.error = '';
    this.loading = true;
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
      .then(async (cred) => {
        const idToken = await cred.user.getIdToken();
        this.session.exchangeIdToken(idToken, { email: cred.user.email || undefined, loginType: 'admin', provider: 'google' }).subscribe({
          next: (res) => {
            this.loading = false;
            if (res?.token) {
              this.session.saveBackendToken(res.token);
              // store super admin flag if present
              const user: any = (res as any)?.user || null;
              const isSuper = user?.is_super === 1 || user?.is_super === true || user?.is_super === '1';
              this.session.setIsSuper(!!isSuper);
              if (user) this.session.setUser(user);
              // Navigate only when admin token is valid
              if (this.session.hasValidSession(true)) {
                this.router.navigate(['/restrito/admin']);
              } else {
                this.showBlockingError('Sessão criada, porém sem permissão de admin.');
              }
            } else {
              this.showBlockingError('Sessão inválida com o servidor');
            }
          },
          error: (e) => {
            this.loading = false;
            console.error(e);
            const msg = e?.error?.error || e?.error?.message || e?.message || 'Falha ao validar sessão com o servidor';
            this.showBlockingError(msg);
          }
        });
      })
      .catch(err => {
        this.loading = false;
        this.showBlockingError(err?.message || 'Falha no login com Google');
      });
  }

  private showBlockingError(message: string) {
    this.error = message;
    this.blocked = true;
    this.countdown = 6;
    const timer = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        clearInterval(timer);
        this.router.navigateByUrl('/');
      }
    }, 1000);
  }

  goHomeNow() {
    this.blocked = false;
    this.router.navigateByUrl('/');
  }
}
