import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { RoleColaborador } from '../../../types/agenda.types';

interface PublicInviteResponse {
  invite: {
    id: number;
    parceiro_id: number;
    parceiro_nome: string;
    email: string;
    nome?: string | null;
    role: RoleColaborador;
    com_vet?: number | boolean;
    status: 'pendente' | 'aceito' | 'cancelado' | 'expirado';
    expires_at?: string | null;
  };
  account: null | {
    id: number;
    parceiroId: number;
    parceiroNome: string;
    nome?: string | null;
    role: RoleColaborador;
  };
}

@Component({
  selector: 'app-aceitar-convite',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './aceitar-convite.component.html',
  styleUrls: ['./aceitar-convite.component.scss'],
})
export class AceitarConviteComponent implements OnInit {
  token = '';
  loading = true;
  submitting = false;
  error = '';
  success = '';
  invite: PublicInviteResponse['invite'] | null = null;
  account: PublicInviteResponse['account'] = null;

  senha = '';
  confirmarSenha = '';
  desvincularParceiroAtual = false;
  desvincularVetDeOutroParceiro = false;

  vet = {
    nome: '',
    cpf: '',
    crmv: '',
    telefone: '',
  };

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router
  ) {}

  get comVet(): boolean {
    const v = this.invite?.com_vet;
    return v === true || v === 1;
  }

  async ngOnInit(): Promise<void> {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    if (!this.token) {
      this.error = 'Token de convite inválido.';
      this.loading = false;
      return;
    }
    await this.loadInvite();
  }

  get precisaDesvincularConta(): boolean {
    return !!this.account && !!this.invite && this.account.parceiroId !== this.invite.parceiro_id;
  }

  private async loadInvite(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const response = await lastValueFrom(
        this.http.get<PublicInviteResponse>(`${environment.apiBaseUrl}/convites/parceiro/${this.token}`)
      );
      this.invite = response.invite;
      this.account = response.account;
      if (this.invite?.nome) this.vet.nome = this.invite.nome;
    } catch (e: any) {
      this.error = e?.error?.error || 'Não foi possível carregar o convite.';
    } finally {
      this.loading = false;
    }
  }

  async aceitar(): Promise<void> {
    this.error = '';
    this.success = '';
    if (this.senha.length < 8) {
      this.error = 'A senha deve ter pelo menos 8 caracteres.';
      return;
    }
    if (this.senha !== this.confirmarSenha) {
      this.error = 'A confirmação de senha não confere.';
      return;
    }
    if (this.precisaDesvincularConta && !this.desvincularParceiroAtual) {
      this.error = 'Confirme a desvinculação do parceiro atual para continuar.';
      return;
    }
    if (this.comVet) {
      if (!this.vet.cpf?.trim() || !this.vet.crmv?.trim() || !this.vet.telefone?.trim()) {
        this.error = 'Preencha CPF, CRMV e telefone para o cadastro veterinário.';
        return;
      }
    }

    this.submitting = true;
    try {
      await lastValueFrom(
        this.http.post(`${environment.apiBaseUrl}/convites/parceiro/accept`, {
          token: this.token,
          senha: this.senha,
          desvincularParceiroAtual: this.desvincularParceiroAtual,
          desvincularVetDeOutroParceiro: this.desvincularVetDeOutroParceiro,
          vet: this.comVet
            ? {
                nome: this.vet.nome?.trim() || undefined,
                cpf: this.vet.cpf.trim(),
                crmv: this.vet.crmv.trim(),
                telefone: this.vet.telefone.trim(),
              }
            : undefined,
        })
      );
      this.success = 'Convite aceito com sucesso. Agora você pode fazer login no painel parceiro.';
      setTimeout(() => this.router.navigate(['/parceiros/login']), 1200);
    } catch (e: any) {
      if (e?.status === 409 && e?.error?.code === 'VET_VINCULADO_OUTRO_PARCEIRO') {
        this.error = `${e.error.error} Marque a opção abaixo para confirmar a transferência do cadastro veterinário.`;
      } else {
        this.error = e?.error?.error || 'Falha ao aceitar convite.';
      }
    } finally {
      this.submitting = false;
    }
  }
}
