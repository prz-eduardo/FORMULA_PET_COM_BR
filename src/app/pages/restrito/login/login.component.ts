import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../../../firebase-config';
import { SessionService } from '../../../services/session.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  error: string = '';
  loading = false;
  blocked = false;
  countdown = 6;
  showPassword = false;

  form: FormGroup;

  constructor(private router: Router, private session: SessionService, private fb: FormBuilder) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      senha: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  private setLoading(loading: boolean) {
    this.loading = loading;
    const opts = { emitEvent: false };
    if (loading) {
      this.form.get('email')?.disable(opts);
      this.form.get('senha')?.disable(opts);
    } else {
      this.form.get('email')?.enable(opts);
      this.form.get('senha')?.enable(opts);
    }
  }

  loginWithPassword() {
    this.error = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, senha } = this.form.value;
    this.setLoading(true);
    this.session.adminLoginPassword(email, senha).subscribe({
      next: (res) => {
        this.setLoading(false);
        this.handleSessionResponse(res);
      },
      error: (e) => {
        this.setLoading(false);
        const msg = e?.error?.error || e?.error?.message || 'Falha ao entrar. Verifique seus dados.';
        // 401/403/429 são erros de usuário — não bloquear com overlay irritante
        this.error = msg;
      }
    });
  }

  loginWithGoogle() {
    this.error = '';
    this.setLoading(true);
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
      .then(async (cred) => {
        const idToken = await cred.user.getIdToken();
        this.session.exchangeIdToken(idToken, { email: cred.user.email || undefined, loginType: 'admin', provider: 'google' }).subscribe({
          next: (res) => {
            this.setLoading(false);
            this.handleSessionResponse(res);
          },
          error: (e) => {
            this.setLoading(false);
            console.error(e);
            const msg = e?.error?.error || e?.error?.message || e?.message || 'Falha ao validar sessão com o servidor';
            this.showBlockingError(msg);
          }
        });
      })
      .catch(err => {
        this.setLoading(false);
        this.showBlockingError(err?.message || 'Falha no login com Google');
      });
  }

  private handleSessionResponse(res: any) {
    if (res?.token) {
      this.session.saveBackendToken(res.token);
      const user: any = res?.user || null;
      const isSuper = user?.is_super === 1 || user?.is_super === true || user?.is_super === '1';
      this.session.setIsSuper(!!isSuper);
      if (user) this.session.setUser(user);
      if (this.session.hasValidSession(true)) {
        this.router.navigate(['/restrito/admin']);
      } else {
        this.showBlockingError('Sessão criada, porém sem permissão de admin.');
      }
    } else {
      this.showBlockingError('Sessão inválida com o servidor');
    }
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
