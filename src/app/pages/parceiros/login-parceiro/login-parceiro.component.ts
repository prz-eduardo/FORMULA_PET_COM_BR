import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';

@Component({
  selector: 'app-login-parceiro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-parceiro.component.html',
  styleUrls: ['./login-parceiro.component.scss'],
})
export class LoginParceiroComponent {
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  constructor(
    private auth: ParceiroAuthService,
    private router: Router,
  ) {}

  onSubmit(): void {
    this.error.set('');
    if (!this.email || !this.password) {
      this.error.set('Preencha e-mail e senha.');
      return;
    }
    this.loading.set(true);
    // Simulate async — in production: call API
    setTimeout(() => {
      const ok = this.auth.loginMock(this.email, this.password);
      this.loading.set(false);
      if (ok) {
        this.router.navigate(['/parceiros/agenda']);
      } else {
        this.error.set('Credenciais inválidas.');
      }
    }, 600);
  }
}
