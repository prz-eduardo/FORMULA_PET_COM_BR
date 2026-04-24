import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../../services/api.service';
import { AuthService } from '../../../../services/auth.service';
import { ToastService } from '../../../../services/toast.service';
import { AdminPaginationComponent } from '../shared/admin-pagination/admin-pagination.component';

@Component({
  selector: 'app-admin-pedidos-pos-venda',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AdminPaginationComponent],
  templateUrl: './pedidos-pos-venda.component.html',
  styleUrls: ['./pedidos-pos-venda.component.scss'],
})
export class AdminPedidosPosVendaComponent implements OnInit {
  loading = false;
  items: any[] = [];
  page = 1;
  pageSize = 20;
  total = 0;
  totalPages = 1;
  filtroStatus = '';
  filtroTipo = '';
  highlightId: number | null = null;

  statusOptions = [
    { v: '', l: 'Pendentes (aberto e em análise)' },
    { v: 'all', l: 'Todos os status' },
    { v: 'aberto', l: 'Só aberto' },
    { v: 'em_analise', l: 'Só em análise' },
    { v: 'resolvido', l: 'Resolvido' },
    { v: 'recusado', l: 'Recusado' },
  ];

  tipoOptions = [
    { v: '', l: 'Todos os tipos' },
    { v: 'relato', l: 'Relato' },
    { v: 'arrependimento', l: 'Arrependimento (CDC)' },
    { v: 'defeito_qualidade', l: 'Defeito / qualidade' },
    { v: 'cancelamento_pre_envio', l: 'Cancelamento (pré-conclusão)' },
  ];

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    private route: ActivatedRoute,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe((q) => {
      const raw = q?.['highlight'];
      const id = raw != null ? Number(raw) : NaN;
      this.highlightId = Number.isFinite(id) && id > 0 ? id : null;
      const tp = (q?.['tipo'] || '').toString().trim().toLowerCase();
      const tiposOk = ['relato', 'arrependimento', 'defeito_qualidade', 'cancelamento_pre_envio'];
      this.filtroTipo = tiposOk.includes(tp) ? tp : '';
      this.page = 1;
      this.load();
    });
  }

  private get token() {
    return isPlatformBrowser(this.platformId) ? this.auth.getToken() : null;
  }

  load() {
    const t = this.token;
    if (!t) {
      this.loading = false;
      return;
    }
    this.loading = true;
    const statusParam =
      this.filtroStatus === '' ? undefined : this.filtroStatus;
    this.api
      .getAdminPedidoSolicitacoes(t, {
        page: this.page,
        pageSize: this.pageSize,
        status: statusParam,
        tipo: this.filtroTipo || undefined,
      })
      .subscribe({
        next: (res) => {
          this.items = res?.data || [];
          this.page = res?.page ?? this.page;
          this.pageSize = res?.pageSize ?? this.pageSize;
          this.total = res?.total ?? 0;
          this.totalPages = res?.totalPages ?? 1;
        },
        error: (e) => {
          this.toast.error(e?.error?.error || 'Erro ao carregar solicitações.');
        },
        complete: () => {
          this.loading = false;
          if (this.highlightId != null && isPlatformBrowser(this.platformId)) {
            setTimeout(() => {
              const el = document.querySelector(`[data-solicitacao-id="${this.highlightId}"]`) as HTMLElement | null;
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 200);
          }
        },
      });
  }

  aplicarFiltros() {
    this.page = 1;
    this.load();
  }

  labelTipo(tipo: string): string {
    const m: Record<string, string> = {
      relato: 'Relato',
      arrependimento: 'Arrependimento',
      defeito_qualidade: 'Defeito / qualidade',
      cancelamento_pre_envio: 'Cancelamento',
    };
    return m[tipo] || tipo;
  }

  labelStatus(st: string): string {
    const m: Record<string, string> = {
      aberto: 'Aberto',
      em_analise: 'Em análise',
      resolvido: 'Resolvido',
      recusado: 'Recusado',
    };
    return m[st] || st;
  }

  async patchStatus(row: any, status: string) {
    const t = this.token;
    if (!t) return;
    try {
      await this.api.patchAdminPedidoSolicitacao(t, row.id, { status }).toPromise();
      this.toast.success('Atualizado.');
      this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'Falha ao atualizar.');
    }
  }

  async salvarNotas(row: any, notas: string) {
    const t = this.token;
    if (!t) return;
    try {
      await this.api.patchAdminPedidoSolicitacao(t, row.id, { admin_notas: notas }).toPromise();
      this.toast.success('Notas salvas.');
      this.load();
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'Falha ao salvar.');
    }
  }

  irPedido(pedidoId: number) {
    this.router.navigate(['/restrito/admin/pedidos'], { queryParams: { highlight: pedidoId } });
  }
}
