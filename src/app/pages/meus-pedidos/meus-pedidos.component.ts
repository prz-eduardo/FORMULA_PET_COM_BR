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
  // Modal de itens
  showItemsModal = false;
  modalItems: any[] = [];
  modalPedido: any = null;

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
  toggleExpand(id: number){
    // Fecha todos os outros (um só aberto por vez)
    const openNow = !!this.expanded[id];
    this.expanded = {}; // reset total
    this.expanded[id] = !openNow;
    // Se abrimos, recentra timeline no status ativo
    if (this.expanded[id]) {
      setTimeout(() => this.scrollTimelineIntoView(id), 0);
    }
  }
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

  private scrollTimelineIntoView(orderId: number){
    try {
      const card = document.querySelector(`article.order-card[data-id="${orderId}"]`) as HTMLElement | null;
      if (!card) return;
      const sp = card.querySelector('.status-progress') as HTMLElement | null;
      if (!sp) return;
      // Prefer label centering; fallback to active segment
      const activeLabel = sp.querySelector('.labels .lab.active') as HTMLElement | null;
      const target = activeLabel || (sp.querySelector('.segments .seg.active') as HTMLElement | null);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const cr = sp.getBoundingClientRect();
      const center = rect.left + rect.width / 2 - cr.left - cr.width / 2;
      sp.scrollBy({ left: center, behavior: 'smooth' });
    } catch {}
  }

  // Modal de itens
  openItemsModal(p: any){
    this.modalPedido = p;
    this.modalItems = this.extractItems(p);
    this.showItemsModal = true;
  }
  closeItemsModal(){ this.showItemsModal = false; }

  private extractItems(p: any): any[] {
    // Tenta várias formas comuns vindas do backend
    const direct = Array.isArray(p?.itens) ? p.itens : [];
    const snapInput = Array.isArray(p?.raw_snapshot?.input?.itens) ? p.raw_snapshot.input.itens : [];
    const snapItens = Array.isArray(p?.raw_snapshot?.itens) ? p.raw_snapshot.itens : [];
    const anyAlt = Array.isArray((p as any)?.items) ? (p as any).items : [];
    const arr = direct.length ? direct : (snapInput.length ? snapInput : (snapItens.length ? snapItens : anyAlt));
    // Normaliza campos para UI
    return arr.map((it: any) => {
      const nome = it?.nome || it?.produto_nome || it?.name || 'Item';
      const quantidade = it?.quantidade ?? it?.qty ?? it?.qtd ?? 1;
      const unit = (it?.valor_unitario ?? it?.preco ?? it?.preco_unit ?? it?.precoUnit ?? it?.price ?? 0);
      const subtotal = it?.subtotal != null ? it.subtotal : (Number(unit) * Number(quantidade));
      return { nome, quantidade, unit, subtotal };
    });
  }

  // Utilitários: endereço
  mapUrl(end: any): string {
    try{
      const parts = [
        end?.logradouro,
        end?.numero,
        end?.bairro,
        end?.cidade,
        end?.estado,
        end?.cep ? `CEP ${String(end.cep)}` : ''
      ].filter(Boolean).join(', ');
      const q = encodeURIComponent(parts);
      return `https://www.google.com/maps/search/?api=1&query=${q}`;
    } catch {
      return 'https://maps.google.com';
    }
  }

  async copyEndereco(end: any){
    try{
      const texto = [
        end?.nome || end?.destinatario,
        `${end?.logradouro || ''}, ${end?.numero || ''}${end?.complemento ? ' - ' + end.complemento : ''}`.trim(),
        `${end?.bairro || ''} - ${end?.cidade || ''}/${end?.estado || ''}`.trim(),
        end?.cep ? `CEP ${String(end.cep)}` : ''
      ].filter(v => !!v && String(v).trim().length).join('\n');
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
      } else {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = texto; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
      }
      this.toast.success('Endereço copiado');
    } catch(err){
      this.toast.info('Não foi possível copiar o endereço');
    }
  }
}
