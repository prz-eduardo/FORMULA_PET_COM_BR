import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import { AuthService } from '../../../../services/auth.service';
import { ApiService } from '../../../../services/api.service';
import { ToastService } from '../../../../services/toast.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-crie-sua-conta',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxMaskDirective],
  providers: [provideNgxMask()],
  templateUrl: './crie-sua-conta.component.html',
  styleUrls: ['./crie-sua-conta.component.scss']
})
export class CrieSuaContaComponent {
  @Output() close = new EventEmitter<void>();
  @Output() loggedIn = new EventEmitter<void>();

  aberto = false;
  carregando = false;
  iniciadoGoogle = false;
  mostrarSenha = false;
  mostrarSenha2 = false;
  mostrarCRMV = false;
  mensagemErro = '';
  etapaGoogle = false;

  ufs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
    private toastService: ToastService
  ) {}

  abrir() { this.aberto = true; }
  fechar() {
    this.aberto = false;
    this.iniciadoGoogle = false;
    this.mensagemErro = '';
    this.mostrarSenha = false;
    this.mostrarSenha2 = false;
    this.mostrarCRMV = false;
  }

  private extrairErro(err: unknown): string {
    const e = err as { error?: { message?: string }; message?: string };
    if (e?.error && typeof e.error === 'object' && e.error !== null && 'message' in e.error) {
      const m = (e.error as { message?: string }).message;
      if (typeof m === 'string' && m.length) return m;
    }
    if (typeof e?.message === 'string' && e.message.length) return e.message;
    return 'Erro ao cadastrar';
  }

  private aplicarSessaoVet(data: { tipo?: string; token?: string }) {
    if (data.tipo) localStorage.setItem('userType', data.tipo);
    if (data.token) this.authService.login(data.token);
  }

  private emitirSucessoCadastro() {
    this.loggedIn.emit();
    this.close.emit();
    this.fechar();
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
    const { nome, email, senha, senha2, cpf, crmvUf, crmvNum, telefone } = form.value;
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
      await this.authService.registerEmail(email, senha);
      const idToken = await this.authService.getIdToken();

      const data = await firstValueFrom(
        this.apiService.cadastrarVet({
          nome,
          email,
          senha,
          cpf,
          crmv: `${crmvUf}-${crmvNum}`,
          telefone,
          tipo: 'vet',
          idToken
        })
      );

      this.aplicarSessaoVet(data);
      this.toastService.success('Conta criada com sucesso!', 'Sucesso');
      this.emitirSucessoCadastro();
    } catch (err: unknown) {
      this.mensagemErro = this.extrairErro(err);
    } finally {
      this.carregando = false;
    }
  }

  async iniciarGoogle(form: any) {
    if (!form.valid) return;
    const { nome, cpf, crmvUf, crmvNum, telefone } = form.value;

    this.carregando = true;
    this.mensagemErro = '';
    try {
      const userCred = await this.authService.loginGoogle();
      const idToken = await this.authService.getIdToken();
      const email = userCred.user.email || '';

      try {
        const data = await firstValueFrom(
          this.apiService.cadastrarVet({
            nome: nome || userCred.user.displayName || 'Sem Nome',
            email,
            cpf,
            crmv: `${crmvUf}-${crmvNum}`,
            telefone,
            tipo: 'vet',
            idToken
          })
        );
        this.aplicarSessaoVet(data);
        this.toastService.success('Conta criada com sucesso via Google!', 'Sucesso');
        this.emitirSucessoCadastro();
      } catch (err: unknown) {
        const msg = this.extrairErro(err);
        if (msg === 'Vet já cadastrado!') {
          const loginData = await firstValueFrom(
            this.apiService.loginVet({ email, idToken })
          );
          this.aplicarSessaoVet(loginData);
          this.toastService.success('Login via Google realizado com sucesso!', 'Sucesso');
          this.emitirSucessoCadastro();
        } else {
          this.mensagemErro = msg;
        }
      }
    } catch (err: unknown) {
      this.mensagemErro = this.extrairErro(err);
    } finally {
      this.carregando = false;
    }
  }

  toggleIniciarGoogle() {
    this.iniciadoGoogle = !this.iniciadoGoogle;
    this.mensagemErro = '';
  }
}
