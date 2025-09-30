import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import { AuthService } from '../../../../services/auth.service';
import { ApiService } from '../../../../services/api.service';
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
    private apiService: ApiService
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
      const userCred = await this.authService.registerEmail(email, senha);
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

      localStorage.setItem('userType', data.tipo);
      localStorage.setItem('token', data.token);
      alert('Conta criada com sucesso!');
      this.fechar();
    } catch (err: any) {
      this.mensagemErro = err.message || 'Erro ao cadastrar';
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

    // Tenta login primeiro
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
  localStorage.setItem('userType', data.tipo);
  localStorage.setItem('token', data.token);
  alert('Conta criada com sucesso via Google!');
} catch (err: any) {
  if (err.message === 'Vet já cadastrado!') {
    // Tenta login automaticamente
    const loginData = await firstValueFrom(
      this.apiService.loginVet({ email, idToken })
    );
    localStorage.setItem('userType', loginData.tipo);
    localStorage.setItem('token', loginData.token);
    alert('Login via Google realizado com sucesso!');
  } else {
    this.mensagemErro = err.message || 'Erro no cadastro/login com Google';
  }
}

    this.fechar();
  } catch (err: any) {
    this.mensagemErro = err.message || 'Erro no cadastro/login com Google';
  } finally {
    this.carregando = false;
  }
}

    toggleIniciarGoogle() {
    this.iniciadoGoogle = !this.iniciadoGoogle;
    this.mensagemErro = '';
  }
}
