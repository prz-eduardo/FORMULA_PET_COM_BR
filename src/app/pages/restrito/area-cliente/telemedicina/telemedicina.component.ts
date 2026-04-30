import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { ApiService } from '../../../../services/api.service';
import { AuthService } from '../../../../services/auth.service';
import { firstValueFrom, Subscription } from 'rxjs';
import { WebrtcService } from '../../../../services/webrtc.service';

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
  providers: [WebrtcService],
  templateUrl: './telemedicina.component.html',
  styleUrl: './telemedicina.component.scss',
})
export class TelemedicinaComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() modal = false;
  @Output() close = new EventEmitter<void>();

  loading = false;
  joinLoadingId: number | null = null;
  erro = '';
  consultas: TelemedicinaConsulta[] = [];
  chamadaAtiva: { sala_codigo: string; signaling_channel: string } | null = null;
  callState = 'idle';
  muted = false;
  videoEnabled = true;

  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;
  private subs: Subscription[] = [];

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private webrtc: WebrtcService
  ) {}

  ngOnInit(): void {
    this.loadConsultas();
  }

  ngAfterViewInit(): void {
    this.subs.push(
      this.webrtc.localStream$.subscribe((s) => {
        try {
          if (this.localVideo && this.localVideo.nativeElement) this.localVideo.nativeElement.srcObject = s || null;
        } catch (e) {}
      })
    );
    this.subs.push(
      this.webrtc.remoteStream$.subscribe((s) => {
        try {
          if (this.remoteVideo && this.remoteVideo.nativeElement) this.remoteVideo.nativeElement.srcObject = s || null;
        } catch (e) {}
      })
    );
    this.subs.push(
      this.webrtc.callState$.subscribe((st) => {
        this.callState = st;
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    try {
      this.webrtc.endCall();
    } catch (e) {}
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
      // consentimento explícito pré-chamada
      const consent = window.confirm(
        'Ao entrar na chamada você concorda em compartilhar câmera e microfone. Apenas metadados serão registrados. Deseja continuar?'
      );
      if (!consent) {
        this.erro = 'Consentimento não concedido.';
        return;
      }

      const teleApi = this.api as TelemedicinaApi;
      const joined: TelemedicinaJoinResponse = await firstValueFrom(teleApi.joinMyTelemedicina(token, c.id));
      if (!joined?.sala_codigo) throw new Error('Resposta inválida ao entrar na chamada');
      this.chamadaAtiva = {
        sala_codigo: joined.sala_codigo,
        signaling_channel: joined.signaling_channel,
      };

      await this.webrtc.joinCall(c.id, joined.sala_codigo);
    } catch (err: any) {
      this.erro = err?.error?.error || err?.error?.message || 'Não foi possível entrar na chamada.';
    } finally {
      this.joinLoadingId = null;
    }
  }

  endCall(): void {
    try {
      this.webrtc.endCall();
    } catch (e) {}
    this.chamadaAtiva = null;
  }

  toggleMute(): void {
    try {
      this.muted = this.webrtc.toggleMute();
    } catch (e) {}
  }

  toggleVideo(): void {
    try {
      this.videoEnabled = this.webrtc.toggleVideo();
    } catch (e) {}
  }
}
