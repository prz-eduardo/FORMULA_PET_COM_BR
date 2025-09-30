import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { AuthService } from '../../../../services/auth.service';
import { ApiService } from '../../../../services/api.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-login-vet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-vet.component.html',
  styleUrls: ['./login-vet.component.scss']
})
export class LoginVetComponent {
  @Output() close = new EventEmitter<void>();
  @Output() loggedIn = new EventEmitter<void>();

  carregando = false;
  mensagemErro = '';
  mostrarSenha = false;
  iniciadoGoogle = false;

  constructor(
    private authService: AuthService,
    private apiService: ApiService
  ) {}

  async loginEmail(form: NgForm) {
    if (!form.valid) return;
    const { email, senha } = form.value;
    this.carregando = true;
    this.mensagemErro = '';

    try {
      // Login Firebase apenas pra criar sessão local
      await this.authService.loginEmail(email, senha);

      // Envia pro backend email + senha, não idToken
      const data = await firstValueFrom(
        this.apiService.loginVet({ email, senha }) // <-- payload correto
      );

      localStorage.setItem('userType', data.tipo);
      localStorage.setItem('token', data.token);
      this.loggedIn.emit();
      this.authService.login(data.token);
      this.close.emit();
    } catch (err: any) {
      this.mensagemErro = err.message || 'Erro ao fazer login.';
    } finally {
      this.carregando = false;
    }
  }

  async loginGoogle() {
    this.carregando = true;
    this.mensagemErro = ''; 
    try {
      await this.authService.loginGoogle();
      const idToken = await this.authService.getIdToken();

      // Envia pro backend email + idToken
      const currentUser = this.authService.getCurrentUser();
      const email = currentUser?.email;
      if (!email) {
        this.mensagemErro = 'Erro: email do usuário não encontrado.';
        this.carregando = false;
        return;
      }
      const data = await firstValueFrom(
        this.apiService.loginVet({ email: currentUser?.email, idToken }) // <-- payload correto
      );

      localStorage.setItem('userType', data.tipo);
      localStorage.setItem('token', data.token);
      this.loggedIn.emit();
      this.authService.login(data.token);
      this.close.emit();
    } catch (err: any) {
      this.mensagemErro = err.message || 'Erro ao autenticar com Google.';
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
      alert('Email de recuperação enviado!');
    } catch (err: any) {
      this.mensagemErro = err.message || 'Erro ao enviar email de recuperação.';
    } finally {
      this.carregando = false;
    }
  }

  toggleIniciarGoogle() {
    this.iniciadoGoogle = !this.iniciadoGoogle;
  }
}
