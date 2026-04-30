import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';

interface ConviteClienteApi {
  id?: number;
  parceiro_id?: number;
  cliente_email?: string;
  escopo?: string;
  status?: string;
  data_expiracao?: string | null;
}

@Component({
  selector: 'app-convite-dados-parceiro',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './convite-dados-parceiro.component.html',
  styleUrls: ['./convite-dados-parceiro.component.scss'],
})
export class ConviteDadosParceiroComponent implements OnInit {
  readonly apiBase = environment.apiBaseUrl;

  token = '';
  loading = signal(true);
  actionLoading = signal(false);
  error = signal<string | null>(null);
  convite = signal<ConviteClienteApi | null>(null);
  success = signal(false);

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    void this.loadInvite();
  }

  private getClienteIdFromSession(): number | null {
    const t = this.auth.getToken();
    if (!t) return null;
    try {
      const p = jwtDecode<{ id?: number; tipo?: string }>(t);
      const tipo = (p.tipo || '').toLowerCase();
      if (tipo !== 'cliente') return null;
      const id = Number(p.id);
      return Number.isFinite(id) && id > 0 ? id : null;
    } catch {
      return null;
    }
  }

  get isClienteLogado(): boolean {
    return this.getClienteIdFromSession() != null;
  }

  async loadInvite(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const r = await lastValueFrom(
        this.http.get<{ convite: ConviteClienteApi }>(`${this.apiBase}/convites/${encodeURIComponent(this.token)}`)
      );
      this.convite.set(r.convite ?? null);
    } catch {
      this.error.set('Convite não encontrado ou inválido.');
      this.convite.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  async aceitar(): Promise<void> {
    const clienteId = this.getClienteIdFromSession();
    if (!clienteId) {
      void this.router.navigate(['/restrito/login'], {
        queryParams: { returnUrl: `/convite-dados/${this.token}` },
      });
      return;
    }
    this.actionLoading.set(true);
    this.error.set(null);
    try {
      await lastValueFrom(
        this.http.post<{ permissao?: unknown }>(
          `${this.apiBase}/convites/accept`,
          { token: this.token, cliente_id: clienteId }
        )
      );
      this.success.set(true);
    } catch (e: unknown) {
      const msg =
        (e as { error?: { error?: string } })?.error?.error ??
        'Não foi possível aceitar o convite.';
      this.error.set(msg);
    } finally {
      this.actionLoading.set(false);
    }
  }
}
