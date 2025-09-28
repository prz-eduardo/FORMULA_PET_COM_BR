// crie-sua-conta.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../services/auth.service';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';

@Component({
  selector: 'app-crie-sua-conta',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxMaskDirective],
  providers: [provideNgxMask()],
  templateUrl: './crie-sua-conta.component.html',
  styleUrls: ['./crie-sua-conta.component.scss']
})
export class CrieSuaContaComponent {
  aberto = false;
  carregando = false;
  etapaGoogle = false;
  tempUser: any = null;
  iniciadoGoogle = false;

  mostrarSenha = false;
  mostrarSenha2 = false;
  mostrarCRMV = false;

  ufs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

  mensagemErro: string = '';

  constructor(private authService: AuthService) {}

  abrir() { this.aberto = true; }
  fechar() {
    this.aberto = false;
    this.etapaGoogle = false;
    this.tempUser = null;
    this.iniciadoGoogle = false;
    this.mensagemErro = '';
    this.mostrarSenha = false;
    this.mostrarSenha2 = false;
    this.mostrarCRMV = false;
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
    const crmv = `${crmvUf}-${crmvNum}`;
    this.carregando = true;
    this.mensagemErro = '';

    if (senha !== senha2) {
      this.mensagemErro = 'As senhas não coincidem!';
      this.carregando = false;
      return;
    }

    if (!this.validarCPF(cpf)) {
      this.mensagemErro = 'CPF inválido!';
      this.carregando = false;
      return;
    }

    try {
      // cadastra normalmente no Auth + Firestore
      await this.authService.registerVet(email, senha, nome, cpf, crmv, telefone);
      alert('Conta criada com sucesso! Aguarde aprovação do admin.');
      this.fechar();
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        this.mensagemErro = 'Este email já está em uso. Tente recuperar a senha ou use outro email.';
      } else {
        this.mensagemErro = 'Erro ao criar conta: ' + err.message;
      }
    } finally {
      this.carregando = false;
    }
  }

  toggleIniciarGoogle() {
    this.iniciadoGoogle = !this.iniciadoGoogle;
    this.mensagemErro = '';
  }

  async iniciarGoogle(form: any) {
    if (!form.valid) return;

    const { cpf, crmvUf, crmvNum, telefone } = form.value;
    const crmv = `${crmvUf}-${crmvNum}`;
    this.carregando = true;
    this.mensagemErro = '';

    try {
      // 1️⃣ Verifica se já existe vet com esse CPF + CRMV
      const existe = await this.authService.verificarVetPorCrmvCpf(crmv, cpf);
      if (existe) {
        this.mensagemErro = 'Vet já cadastrado! Recupere a senha ou contate o suporte.';
        this.carregando = false;
        return;
      }

      // 2️⃣ Login com Google
      const user = await this.authService.loginGoogle();

      // 3️⃣ Cadastra no Firestore
      await this.authService.registerVet(
        user.email!,
        'firebase-google',
        user.displayName || 'Sem Nome',
        cpf,
        crmv,
        telefone
      );

      alert('Conta criada com sucesso! Aguarde aprovação do admin.');
      this.fechar();
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        if (err.code === 'auth/email-already-in-use') {
          this.mensagemErro = 'Este email já está em uso. Tente recuperar a senha ou use outro email.';
        } else {
          this.mensagemErro = 'Erro: ' + err.message;
        }
      }
    } finally {
      this.carregando = false;
    }
  }
}
