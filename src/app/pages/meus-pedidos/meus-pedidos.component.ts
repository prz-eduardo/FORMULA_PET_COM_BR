import { Component, Input, Output, EventEmitter, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavmenuComponent } from '../../navmenu/navmenu.component';
import { RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-meus-pedidos',
  standalone: true,
  imports: [CommonModule, FormsModule, NavmenuComponent, RouterOutlet],
  templateUrl: './meus-pedidos.component.html',
  styleUrls: ['./meus-pedidos.component.scss']
})
export class MeusPedidosComponent {
  @Input() modal: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() openStatus = new EventEmitter<string>();
  pedidos: any[] = [];
  buscaCodigo = '';
  carregando = false;
  erro = '';
  // controle de expansão por pedido
  expanded: Record<number, boolean> = {};
  // filtros & paginação
  page = 1; pageSize = 20; total = 0; totalPages = 1;
  filtroStatus = '';
  filtroPgStatus = '';
  filtroPgForma = '';
  filtroFrom = '';
  filtroTo = '';
  includeDetails = false;

  constructor(
    private router: Router,
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    @Inject(PLATFORM_ID) private platformId: Object
  ){}

  private get token(): string | null {
    return isPlatformBrowser(this.platformId) ? this.auth.getToken() : null;
  }

  ngOnInit(){
    this.load();
  }

  load(){
    const t = this.token;
    if (!t) { this.pedidos = []; this.total = 0; this.totalPages = 1; return; }
    this.carregando = true; this.erro = '';
    this.api.listMyOrders(t, {
      page: this.page,
      pageSize: this.pageSize,
      status: this.filtroStatus || undefined,
      pagamento_status: this.filtroPgStatus || undefined,
      pagamento_forma: this.filtroPgForma || undefined,
      from: this.filtroFrom || undefined,
      to: this.filtroTo || undefined,
      q: this.buscaCodigo || undefined,
      include: this.includeDetails ? 'details' : undefined
    }).subscribe({
      next: (res) => {
        this.pedidos = Array.isArray(res?.data) ? res.data : [];
        this.page = res?.page ?? this.page;
        this.pageSize = res?.pageSize ?? this.pageSize;
        this.total = res?.total ?? 0;
        this.totalPages = res?.totalPages ?? 1;
      },
      error: (err) => {
        this.erro = err?.error?.message || err?.message || 'Erro ao carregar pedidos';
        this.toast.error(this.erro);
      },
      complete: () => this.carregando = false
    });
  }

  abrirStatus(codigo: string){
    // Não abrimos mais o modal de consulta; alterna expansão do card
    const id = Number(codigo);
    if (!isNaN(id)) this.toggleExpand(id);
  }

  consultarPorCodigo(){
    const code = (this.buscaCodigo || '').trim();
    if (!code) return;
    this.page = 1; // reseta paginação
    this.load();
  }

  voltar(){
    if (this.modal) {
      this.close.emit();
      return;
    }
    // Fecha qualquer modal aberto e volta para área do cliente
    this.router.navigateByUrl('/area-cliente');
  }

  // paginação simples
  prevPage(){ if (this.page > 1){ this.page--; this.load(); } }
  nextPage(){ if (this.page < this.totalPages){ this.page++; this.load(); } }

  // UI helpers
  toggleExpand(id: number){ this.expanded[id] = !this.expanded[id]; }
  isConcluido(p: any){ return (p?.status || '').toLowerCase() === 'concluido'; }
  isCancelado(p: any){ return (p?.status || '').toLowerCase() === 'cancelado'; }

  carregarDetalhes(){
    if (!this.includeDetails){
      this.includeDetails = true;
      this.load();
    }
  }

  statusSteps(p: any){
    const status = (p?.status || '').toLowerCase();
    // Ordem oficial:
    const flow = ['criado','aguardando_pagamento','pago','em_preparo','enviado','concluido'];
    const idx = Math.max(0, flow.indexOf(status));
    const steps = flow.map((k, i) => ({
      key: k,
      label: this.statusLabel(k),
      done: idx >= i,
      active: idx === i
    }));
    // Se cancelado, marca apenas 'criado' como done e desativa os demais
    if (status === 'cancelado'){
      return steps.map((s, i) => ({ ...s, done: i === 0, active: false }));
    }
    return steps;
  }

  statusLabel(s: string){
    const k = (s || '').toLowerCase();
    switch(k){
      case 'criado': return 'Criado';
      case 'aguardando_pagamento': return 'Aguardando pgto';
      case 'pago': return 'Pago';
      case 'em_preparo': return 'Em preparo';
      case 'enviado': return 'Enviado';
      case 'concluido': return 'Concluído';
      case 'cancelado': return 'Cancelado';
      default: return s || '—';
    }
  }
}
