import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgendaApiService } from '../agenda/services/agenda-api.service';
import { ParceiroServico } from '../../../types/agenda.types';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';

@Component({
  selector: 'app-servicos-parceiro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './servicos-parceiro.component.html',
  styleUrls: ['./servicos-parceiro.component.scss'],
})
export class ServicosParceiroComponent implements OnInit {
  servicos: ParceiroServico[] = [];
  loading = false;
  saving = false;
  error = '';
  success = '';

  editingId: number | null = null;

  form = {
    nome: '',
    duracaoMin: 30,
    preco: 0,
    ativo: true,
  };

  constructor(
    private api: AgendaApiService,
    public auth: ParceiroAuthService
  ) {}

  ngOnInit(): void {
    void this.load();
  }

  isAtivo(s: ParceiroServico): boolean {
    return s.ativo === true || s.ativo === 1;
  }

  formatPreco(v: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
  }

  async load(): Promise<void> {
    this.error = '';
    this.loading = true;
    try {
      this.servicos = await this.api.getServicos();
    } catch (e: any) {
      this.error = e?.error?.error || 'Falha ao carregar serviços';
      this.servicos = [];
    } finally {
      this.loading = false;
    }
  }

  resetForm(): void {
    this.editingId = null;
    this.form = { nome: '', duracaoMin: 30, preco: 0, ativo: true };
  }

  editar(s: ParceiroServico): void {
    this.editingId = s.id;
    this.form = {
      nome: s.nome,
      duracaoMin: s.duracao_minutos,
      preco: Number(s.preco),
      ativo: this.isAtivo(s),
    };
    this.success = '';
    this.error = '';
  }

  async salvar(): Promise<void> {
    if (!this.auth.isMaster()) return;
    this.success = '';
    this.error = '';
    const nome = this.form.nome.trim();
    if (!nome) {
      this.error = 'Informe o nome do serviço.';
      return;
    }
    this.saving = true;
    try {
      if (this.editingId != null) {
        await this.api.updateServico(this.editingId, {
          nome,
          duracao_minutos: this.form.duracaoMin,
          preco: this.form.preco,
          ativo: this.form.ativo,
        });
        this.success = 'Serviço atualizado.';
      } else {
        await this.api.createServico({
          nome,
          duracao_minutos: this.form.duracaoMin,
          preco: this.form.preco,
          ativo: this.form.ativo,
        });
        this.success = 'Serviço cadastrado.';
      }
      this.resetForm();
      await this.load();
    } catch (e: any) {
      this.error = e?.error?.error || 'Falha ao salvar';
    } finally {
      this.saving = false;
    }
  }

  async inativar(s: ParceiroServico): Promise<void> {
    if (!this.auth.isMaster()) return;
    if (!window.confirm(`Inativar o serviço "${s.nome}"? Ele deixa de aparecer nas opções novas da agenda.`)) return;
    this.error = '';
    this.success = '';
    try {
      await this.api.deleteServico(s.id);
      this.success = 'Serviço inativado.';
      if (this.editingId === s.id) this.resetForm();
      await this.load();
    } catch (e: any) {
      this.error = e?.error?.error || 'Falha ao inativar';
    }
  }

  async reativar(s: ParceiroServico): Promise<void> {
    if (!this.auth.isMaster()) return;
    this.error = '';
    this.success = '';
    try {
      await this.api.updateServico(s.id, { ativo: true });
      this.success = 'Serviço reativado.';
      await this.load();
    } catch (e: any) {
      this.error = e?.error?.error || 'Falha ao reativar';
    }
  }
}
