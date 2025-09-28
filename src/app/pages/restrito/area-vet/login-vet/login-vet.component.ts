import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-login-vet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-vet.component.html',
  styleUrls: ['./login-vet.component.scss']
})
export class LoginVetComponent {

  @Output() close = new EventEmitter<void>();
  carregando = false;
  mensagemErro: string = '';
  mostrarSenha = false;
  iniciadoGoogle = false;

  constructor(private authService: AuthService) {}

  async loginEmail(form: NgForm) {
    if (!form.valid) return;
    const { email, senha } = form.value;
    this.carregando = true;
    this.mensagemErro = '';

    try {
      await this.authService.loginEmail(email, senha);
      this.close.emit();
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        this.mensagemErro = 'Usuário não encontrado.';
      } else if (err.code === 'auth/wrong-password') {
        this.mensagemErro = 'Senha incorreta.';
      } else {
        this.mensagemErro = 'Erro: ' + err.message;
      }
    } finally {
      this.carregando = false;
    }
  }

  async loginGoogle() {
    this.carregando = true;
    this.mensagemErro = '';
    try {
      const user = await this.authService.loginGoogle();
      // caso o documento do vet não exista ainda
      const existe = await this.authService.getVet(user.uid);
      if (!existe) {
        alert('Conta não encontrada no sistema. Complete o cadastro.');
      } else {
        alert('Login realizado com sucesso!');
        this.close.emit();
      }
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        this.mensagemErro = 'Erro: ' + err.message;
      }
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
    this.mensagemErro = '';
    try {
      await this.authService.sendPasswordReset(email);
      alert('Email de recuperação enviado!');
    } catch (err: any) {
      this.mensagemErro = 'Erro: ' + err.message;
    } finally {
      this.carregando = false;
    }
  }

  toggleIniciarGoogle() {
    this.iniciadoGoogle = !this.iniciadoGoogle;
    this.mensagemErro = '';
  }

}
