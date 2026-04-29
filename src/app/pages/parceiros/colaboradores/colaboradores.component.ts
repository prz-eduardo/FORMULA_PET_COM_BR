import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgendaApiService } from '../agenda/services/agenda-api.service';
import { Colaborador, ColaboradorInvite, RoleColaborador } from '../../../types/agenda.types';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';

@Component({
  selector: 'app-parceiros-colaboradores',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './colaboradores.component.html',
  styleUrls: ['./colaboradores.component.scss'],
})
export class ColaboradoresComponent implements OnInit {
  colaboradores: Colaborador[] = [];
  invites: ColaboradorInvite[] = [];
  loading = false;
  loadingInvites = false;
  error = '';
  success = '';

  convite = {
    nome: '',
    email: '',
    role: 'colaborador' as RoleColaborador,
    comVet: false,
    expiresInHours: 48,
  };

  constructor(
    private api: AgendaApiService,
    public auth: ParceiroAuthService
  ) {}

  ngOnInit(): void {
    this.reloadAll();
  }

  async reloadAll(): Promise<void> {
    this.error = '';
    await Promise.all([this.loadColaboradores(), this.loadInvites()]);
  }

  async loadColaboradores(): Promise<void> {
    this.loading = true;
    try {
      this.colaboradores = await this.api.getColaboradores();
    } catch (e: any) {
      this.error = e?.error?.error || 'Falha ao carregar colaboradores';
    } finally {
      this.loading = false;
    }
  }

  async loadInvites(): Promise<void> {
    this.loadingInvites = true;
    try {
      this.invites = await this.api.getColaboradorInvites();
    } catch (e: any) {
      this.error = e?.error?.error || 'Falha ao carregar convites';
    } finally {
      this.loadingInvites = false;
    }
  }

  onConviteRoleChange(role: RoleColaborador): void {
    if (role === 'master') this.convite.comVet = false;
  }

  async convidar(): Promise<void> {
    this.success = '';
    this.error = '';
    try {
      const response = await this.api.inviteColaborador({
        email: this.convite.email,
        nome: this.convite.nome || undefined,
        role: this.convite.role,
        com_vet: this.convite.comVet,
        expiresInHours: this.convite.expiresInHours,
      });
      this.success = `Convite enviado com sucesso para ${response.invite.email}.`;
      this.convite = { nome: '', email: '', role: 'colaborador', comVet: false, expiresInHours: 48 };
      await this.loadInvites();
    } catch (e: any) {
      this.error = e?.error?.error || 'Falha ao enviar convite';
    }
  }

  async inativar(colaborador: Colaborador): Promise<void> {
    if (!window.confirm(`Deseja inativar o colaborador ${colaborador.nome}?`)) return;
    this.error = '';
    this.success = '';
    try {
      await this.api.deleteColaborador(colaborador.id);
      this.success = 'Colaborador inativado.';
      await this.loadColaboradores();
    } catch (e: any) {
      this.error = e?.error?.error || 'Falha ao inativar colaborador';
    }
  }

  async cancelarInvite(invite: ColaboradorInvite): Promise<void> {
    if (!window.confirm(`Cancelar convite pendente para ${invite.email}?`)) return;
    this.error = '';
    this.success = '';
    try {
      await this.api.cancelInvite(invite.id);
      this.success = 'Convite cancelado.';
      await this.loadInvites();
    } catch (e: any) {
      this.error = e?.error?.error || 'Falha ao cancelar convite';
    }
  }
}
