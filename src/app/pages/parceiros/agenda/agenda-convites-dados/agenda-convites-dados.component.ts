import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgendaApiService, PermissaoDadosRow } from '../services/agenda-api.service';

@Component({
  selector: 'app-agenda-convites-dados',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agenda-convites-dados.component.html',
  styleUrls: ['./agenda-convites-dados.component.scss'],
})
export class AgendaConvitesDadosComponent {
  expanded = signal(false);
  email = signal('');
  escopo = signal<'dados_basicos' | 'pets' | 'completo'>('dados_basicos');
  loading = signal(false);
  tokenHint = signal<string | null>(null);
  error = signal<string | null>(null);
  permissoes = signal<PermissaoDadosRow[]>([]);

  constructor(private api: AgendaApiService) {}

  async toggle(): Promise<void> {
    const next = !this.expanded();
    this.expanded.set(next);
    this.error.set(null);
    if (next) {
      try {
        const rows = await this.api.listPermissoesDados();
        this.permissoes.set(rows);
      } catch {
        this.permissoes.set([]);
      }
    }
  }

  async enviar(): Promise<void> {
    const em = this.email().trim().toLowerCase();
    if (!em) {
      this.error.set('Informe o e-mail do tutor.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.tokenHint.set(null);
    try {
      const res = await this.api.postConviteCliente({
        cliente_email: em,
        escopo: this.escopo(),
        days_valid: 7,
      });
      const convite = res.convite as { token?: string } | null;
      this.tokenHint.set(convite?.token ?? null);
      this.email.set('');
    } catch (e: unknown) {
      const msg = (e as { error?: { error?: string } })?.error?.error ?? 'Falha ao criar convite';
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }
}
