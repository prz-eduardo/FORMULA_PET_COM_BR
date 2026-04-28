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
    
    // Call real login endpoint
    this.auth.login(this.email, this.password)
      .then(() => {
        this.loading.set(false);
        this.router.navigate(['/parceiros/agenda']);
      })
      .catch((err) => {
        this.loading.set(false);
        console.error('Login error:', err);
        this.error.set(err?.error?.error || 'Credenciais inválidas.');
      });
  }
}
