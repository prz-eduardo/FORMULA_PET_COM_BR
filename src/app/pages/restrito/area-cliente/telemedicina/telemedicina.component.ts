import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ApiService } from '../../../../services/api.service';
import { AuthService } from '../../../../services/auth.service';
import { firstValueFrom } from 'rxjs';

type TelemedicinaConsulta = {
  id: number;
  cliente_id?: number | null;
  veterinario_id?: number | null;
  status: string;
  telemedicina_habilitada: number | boolean;
  janela_inicio: string;
  janela_fim: string;
  video_chamada_id?: number | null;
  sala_codigo?: string | null;
  video_status?: string | null;
};

type TelemedicinaListResponse = { consultas: TelemedicinaConsulta[] };
type TelemedicinaJoinResponse = {
  consulta_id: number;
  sala_codigo: string;
  signaling_event: string;
  signaling_channel: string;
};
type TelemedicinaApi = ApiService & {
  listMyTelemedicina(token: string): import('rxjs').Observable<TelemedicinaListResponse>;
  joinMyTelemedicina(token: string, consultaId: number | string): import('rxjs').Observable<TelemedicinaJoinResponse>;
};

@Component({
  selector: 'app-telemedicina-cliente',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './telemedicina.component.html',
  styleUrl: './telemedicina.component.scss',
})
export class TelemedicinaComponent implements OnInit {
  @Input() modal = false;
  @Output() close = new EventEmitter<void>();

  loading = false;
  joinLoadingId: number | null = null;
  erro = '';
  consultas: TelemedicinaConsulta[] = [];
  chamadaAtiva: { sala_codigo: string; signaling_channel: string } | null = null;

  constructor(
    private api: ApiService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadConsultas();
  }

  get now(): number {
    return Date.now();
  }

  janelaDisponivel(c: TelemedicinaConsulta): boolean {
    const inicio = new Date(c.janela_inicio).getTime();
    const fim = new Date(c.janela_fim).getTime();
    if (!Number.isFinite(inicio) || !Number.isFinite(fim)) return false;
    return this.now >= inicio && this.now <= fim;
  }

  async loadConsultas(): Promise<void> {
    const token = this.auth.getToken();
    if (!token) {
      this.erro = 'Sessão inválida.';
      return;
    }

    this.loading = true;
    this.erro = '';
    try {
      const teleApi = this.api as TelemedicinaApi;
      const res: TelemedicinaListResponse = await firstValueFrom(teleApi.listMyTelemedicina(token));
      this.consultas = (res?.consultas || []).sort(
        (a: TelemedicinaConsulta, b: TelemedicinaConsulta) =>
          new Date(b.janela_inicio).getTime() - new Date(a.janela_inicio).getTime()
      );
    } catch (err: any) {
      this.erro = err?.error?.error || err?.error?.message || 'Não foi possível carregar Telemedicina.';
      this.consultas = [];
    } finally {
      this.loading = false;
    }
  }

  async entrar(c: TelemedicinaConsulta): Promise<void> {
    const token = this.auth.getToken();
    if (!token || this.joinLoadingId) return;
    this.joinLoadingId = c.id;
    this.erro = '';
    try {
      const teleApi = this.api as TelemedicinaApi;
      const joined: TelemedicinaJoinResponse = await firstValueFrom(teleApi.joinMyTelemedicina(token, c.id));
      if (!joined?.sala_codigo) throw new Error('Resposta inválida ao entrar na chamada');
      this.chamadaAtiva = {
        sala_codigo: joined.sala_codigo,
        signaling_channel: joined.signaling_channel,
      };
    } catch (err: any) {
      this.erro = err?.error?.error || err?.error?.message || 'Não foi possível entrar na chamada.';
    } finally {
      this.joinLoadingId = null;
    }
  }
}
