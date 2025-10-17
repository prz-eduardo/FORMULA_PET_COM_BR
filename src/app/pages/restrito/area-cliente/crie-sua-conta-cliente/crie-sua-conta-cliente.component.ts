import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import { AuthService } from '../../../../services/auth.service';
import { ApiService } from '../../../../services/api.service';
import { ToastService } from '../../../../services/toast.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-crie-sua-conta-cliente',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxMaskDirective],
  providers: [provideNgxMask()],
  templateUrl: './crie-sua-conta-cliente.component.html',
  styleUrls: ['./crie-sua-conta-cliente.component.scss']
})
export class CrieSuaContaClienteComponent {
  @Output() close = new EventEmitter<void>();
  @Output() loggedIn = new EventEmitter<void>();
  aberto = false;
  carregando = false;
  iniciadoGoogle = true;
  showEmailForm = false;

  etapaGoogle = false;
  mostrarSenha = false;
  mostrarSenha2 = false;
  mensagemErro = '';

  ufs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

  constructor(
    private authService: AuthService,
    private apiService: ApiService
    , private toastService: ToastService
  ) {}

  abrir() { this.aberto = true; }
  fechar() {
    this.aberto = false;
    this.iniciadoGoogle = false;
    this.mensagemErro = '';
    this.mostrarSenha = false;
    this.mostrarSenha2 = false;
  }

  validarCPF(cpf: string): boolean {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(cpf.charAt(i)) * (10 - i);
    let resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    if (resto !== parseInt(cpf.charAt(9))) return false;

    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(cpf.charAt(i)) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    return resto === parseInt(cpf.charAt(10));
  }

  async cadastrar(form: any) {
    if (!form.valid) return;
    const { nome, email, senha, senha2, cpf, telefone } = form.value;
    if (senha !== senha2) {
      this.mensagemErro = 'As senhas não coincidem!';
      return;
    }
    if (!this.validarCPF(cpf)) {
      this.mensagemErro = 'CPF inválido!';
      return;
    }

    this.carregando = true;
    this.mensagemErro = '';
    try {
      const userCred = await this.authService.registerEmail(email, senha);
      const idToken = await this.authService.getIdToken();

      const data = await firstValueFrom(
        this.apiService.cadastrarCliente({
          nome,
          email,
          senha,
          cpf,
          telefone,
          tipo: 'cliente',
          idToken
        })
      );

    // Auto-login: inform AuthService and emit event so parent can update UI
    this.authService.login(data.token, true);
    localStorage.setItem('userType', data.tipo);
    if (data.token) localStorage.setItem('token', data.token);
    this.toastService.success('Conta criada com sucesso!', 'Sucesso');
    this.loggedIn.emit();
    this.close.emit();
    this.fechar();
    } catch (err: any) {
      const msg = this.parseError(err) || 'Erro ao cadastrar cliente.';
      console.error('Erro ao cadastrar cliente:', err);
      this.mensagemErro = msg;
  // Mostrar um feedback imediato caso o template não apresente o erro
  this.toastService.error(msg, 'Erro');
    } finally {
      this.carregando = false;
    }
  }

  async iniciarGoogle(form: any) {
    if (!form.valid) return;
    const { nome, cpf, telefone } = form.value;

    this.carregando = true;
    this.mensagemErro = '';
    try {
      const userCred = await this.authService.loginGoogle();
      const idToken = await this.authService.getIdToken();
      const email = userCred.user.email || '';

        try {
          const data = await firstValueFrom(
            this.apiService.cadastrarCliente({
              nome: nome || userCred.user.displayName || 'Sem Nome',
              email,
              cpf,
              telefone,
              tipo: 'cliente',
              idToken
            })
          );
          // Auto-login after Google signup
          this.authService.login(data.token, true);
          localStorage.setItem('userType', data.tipo);
          if (data.token) localStorage.setItem('token', data.token);
          this.toastService.success('Conta criada com sucesso via Google!', 'Sucesso');
          this.loggedIn.emit();
          this.close.emit();
        } catch (err: any) {
        const msgInner = this.parseError(err);
        if (msgInner === 'Vet já cadastrado!' || msgInner === 'Cliente já cadastrado!') {
          const loginData = await firstValueFrom(
            this.apiService.loginCliente({ email, idToken })
          );
          // Auto-login for existing client detected via Google
          this.authService.login(loginData.token, true);
          localStorage.setItem('userType', loginData.tipo);
          if (loginData.token) localStorage.setItem('token', loginData.token);
          this.toastService.success('Login via Google realizado com sucesso!', 'Sucesso');
          this.loggedIn.emit();
          this.close.emit();
        } else {
          const msg = msgInner || 'Erro no cadastro/login com Google';
          this.mensagemErro = msg;
          console.error('Erro no cadastro/login com Google:', err);
          this.toastService.error(msg, 'Erro');
        }
      }

      this.fechar();
    } catch (err: any) {
      const msg = this.parseError(err) || 'Erro no cadastro/login com Google';
      this.mensagemErro = msg;
      console.error('Erro no cadastro/login com Google:', err);
  this.toastService.error(msg, 'Erro');
    } finally {
      this.carregando = false;
    }
  }

  // Extrai mensagem de erro de diferentes formatos (HttpErrorResponse, fetch, throw new Error, backend JSON)
  private parseError(err: any): string | null {
    if (!err) return null;
    // Angular HttpErrorResponse often has err.error which may be object/string
    if (err.error) {
      // se o backend retornou { message: '...' }
      if (typeof err.error === 'string') {
        // tentar parsear JSON
        try {
          const parsed = JSON.parse(err.error);
          if (parsed && parsed.message) return parsed.message;
        } catch (e) {
          return err.error; // texto cru
        }
      }
      if (typeof err.error === 'object') {
        if (err.error.message) return err.error.message;
        if (err.error.error) return err.error.error;
      }
    }
    // Alguns erros lançados têm message
    if (err.message) return err.message;
    // Erro HTTP com statusText
    if (err.statusText) return `${err.status || ''} ${err.statusText}`.trim();
    return null;
  }

  toggleEmailForm() { this.showEmailForm = !this.showEmailForm; this.mensagemErro = ''; }
}
