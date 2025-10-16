import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { AuthService } from '../../../../services/auth.service';
import { ApiService } from '../../../../services/api.service';
import { ToastService } from '../../../../services/toast.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-login-cliente',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-cliente.component.html',
  styleUrl: './login-cliente.component.scss'
})
export class LoginClienteComponent {
  @Output() close = new EventEmitter<void>();
  @Output() loggedIn = new EventEmitter<void>();

  carregando = false;
  mensagemErro = '';
  mostrarSenha = false;
  iniciadoGoogle = false;
  manterLogin = true; // default: manter login (persistente)

  constructor(
    private authService: AuthService,
    private apiService: ApiService
    , private toastService: ToastService
  ) {}

  async loginEmail(form: NgForm) {
    if (!form.valid) return;
    const { email, senha } = form.value;
    this.carregando = true;
    this.mensagemErro = '';

    try {
      // Login Firebase apenas pra criar sessão local
      await this.authService.loginEmail(email, senha);

      // Envia pro backend email + senha (cliente)
      const data = await firstValueFrom(
        this.apiService.loginCliente({ email, senha })
      );

      // AuthService.login cuidará de persistência (localStorage vs sessionStorage)
      this.authService.login(data.token, this.manterLogin);
      // Guardar tipo de usuário em storage persistente (localStorage) se o usuário optar por manter o login,
      // caso contrário armazenamos em sessionStorage para a sessão atual.
      if (this.manterLogin) {
        localStorage.setItem('userType', data.tipo);
      } else {
        sessionStorage.setItem('userType', data.tipo);
      }
      this.loggedIn.emit();
      this.close.emit();
    } catch (err: any) {
      const parsed = this.parseErrorLocal(err) || 'Erro ao fazer login.';
      this.mensagemErro = parsed;
      this.toastService.error(parsed, 'Erro no login');
    } finally {
      this.carregando = false;
    }
  }

  // Extrai mensagem de erro de formatos comuns (HttpErrorResponse, fetch, string)
  private parseErrorLocal(err: any): string | null {
    if (!err) return null;
    // Angular HttpErrorResponse
    if (err.error) {
      if (typeof err.error === 'string') {
        try { const p = JSON.parse(err.error); if (p && p.message) return p.message; } catch(e) { return err.error; }
      }
      if (typeof err.error === 'object') {
        if (err.error.message) return err.error.message;
        if (err.error.error) return err.error.error;
      }
    }
    if (err.message) return err.message;
    if (err.status && err.statusText) return `${err.status} ${err.statusText}`;
    return null;
  }

  async loginGoogle() {
    this.carregando = true;
    this.mensagemErro = ''; 
    try {
      await this.authService.loginGoogle();
      const idToken = await this.authService.getIdToken();

      const currentUser = this.authService.getCurrentUser();
      const email = currentUser?.email;
      if (!email) {
        this.mensagemErro = 'Erro: email do usuário não encontrado.';
        this.carregando = false;
        return;
      }
      const data = await firstValueFrom(
        this.apiService.loginCliente({ email: currentUser?.email, idToken })
      );

      this.authService.login(data.token, this.manterLogin);
      if (this.manterLogin) {
        localStorage.setItem('userType', data.tipo);
      } else {
        sessionStorage.setItem('userType', data.tipo);
      }
      this.loggedIn.emit();
      this.close.emit();
    } catch (err: any) {
      const parsed = this.parseErrorLocal(err) || 'Erro ao autenticar com Google.';
      this.mensagemErro = parsed;
      this.toastService.error(parsed, 'Erro no login');
    } finally {
      this.carregando = false;
    }
  }

  async resetSenha(email: string) {
    if (!email) {
      this.mensagemErro = 'Informe o email para recuperação.';
      return;
    }
    this.carregando = true;
    try {
  await this.authService.sendPasswordReset(email);
  this.toastService.success('Email de recuperação enviado!', 'Sucesso');
    } catch (err: any) {
      const parsed = this.parseErrorLocal(err) || 'Erro ao enviar email de recuperação.';
      this.mensagemErro = parsed;
      this.toastService.error(parsed, 'Erro');
    } finally {
      this.carregando = false;
    }
  }

  toggleIniciarGoogle() {
    this.iniciadoGoogle = !this.iniciadoGoogle;
  }

}
