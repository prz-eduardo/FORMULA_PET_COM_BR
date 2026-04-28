import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

const API_BASE = '/api';

type Step = 'email' | 'code' | 'password' | 'success';

@Component({
  selector: 'app-recuperar-senha-parceiro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recuperar-senha-parceiro.component.html',
  styleUrls: ['./recuperar-senha-parceiro.component.scss'],
})
export class RecuperarSenhaParceiroComponent {
  step = signal<Step>('email');
  
  // Step 1: Email
  email = '';
  
  // Step 2: Code
  code = '';
  
  // Step 3: Password
  newPassword = '';
  confirmPassword = '';
  
  // States
  loading = signal(false);
  error = signal('');
  success = signal('');

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  async requestCode(): Promise<void> {
    this.error.set('');
    this.success.set('');

    if (!this.email) {
      this.error.set('Email é obrigatório');
      return;
    }

    this.loading.set(true);

    try {
      await lastValueFrom(
        this.http.post(`${API_BASE}/parceiro/auth/forgot-password`, {
          email: this.email,
        })
      );

      this.success.set('Código enviado para seu email');
      setTimeout(() => {
        this.step.set('code');
        this.success.set('');
      }, 1500);
    } catch (err: any) {
      this.error.set(err?.error?.error || 'Erro ao solicitar código');
    } finally {
      this.loading.set(false);
    }
  }

  async validateCode(): Promise<void> {
    this.error.set('');
    this.success.set('');

    if (!this.code) {
      this.error.set('Código é obrigatório');
      return;
    }

    this.loading.set(true);

    try {
      await lastValueFrom(
        this.http.post(`${API_BASE}/parceiro/auth/validate-reset-code`, {
          email: this.email,
          code: this.code,
        })
      );

      this.success.set('Código validado');
      setTimeout(() => {
        this.step.set('password');
        this.success.set('');
      }, 1000);
    } catch (err: any) {
      this.error.set(err?.error?.error || 'Código inválido');
    } finally {
      this.loading.set(false);
    }
  }

  async resetPassword(): Promise<void> {
    this.error.set('');
    this.success.set('');

    if (!this.newPassword || !this.confirmPassword) {
      this.error.set('Preencha a nova senha');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.error.set('As senhas não correspondem');
      return;
    }

    if (this.newPassword.length < 6) {
      this.error.set('Senha deve ter no mínimo 6 caracteres');
      return;
    }

    this.loading.set(true);

    try {
      await lastValueFrom(
        this.http.post(`${API_BASE}/parceiro/auth/reset-password`, {
          email: this.email,
          code: this.code,
          newPassword: this.newPassword,
        })
      );

      this.success.set('Senha resetada com sucesso!');
      this.step.set('success');
      
      setTimeout(() => {
        this.router.navigate(['/parceiros/login']);
      }, 2000);
    } catch (err: any) {
      this.error.set(err?.error?.error || 'Erro ao resetar senha');
    } finally {
      this.loading.set(false);
    }
  }

  goBack(): void {
    if (this.step() === 'email') {
      this.router.navigate(['/parceiros/login']);
    } else if (this.step() === 'code') {
      this.step.set('email');
      this.code = '';
    } else if (this.step() === 'password') {
      this.step.set('code');
      this.newPassword = '';
      this.confirmPassword = '';
    }
  }

  goToLogin(): void {
    this.router.navigate(['/parceiros/login']);
  }
}
