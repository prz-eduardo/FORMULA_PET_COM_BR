import { Component, Inject, PLATFORM_ID, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../services/api.service';
import { AuthService } from '../../../../services/auth.service';
import { ToastService } from '../../../../services/toast.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-consultar-pedidos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" *ngIf="!modal" (click)="fechar()"></div>
    <div class="modal-content" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <h2>Status do Pedido</h2>
        <button class="btn-close" (click)="fechar()" aria-label="Fechar">✕</button>
      </div>
      <form (ngSubmit)="consultar()" #f="ngForm" class="form">
        <div class="field">
          <label for="codigo">Código do pedido</label>
          <input id="codigo" name="codigo" [(ngModel)]="codigo" required placeholder="Ex: FP-12345" />
        </div>
        <button type="submit" [disabled]="carregando || !codigo">Consultar</button>
      </form>
      <div class="resultado" *ngIf="pedido">
        <div class="top">
          <div class="pedido-id">
            <div class="codigo">{{ pedido.codigo }}</div>
            <div class="badge" [ngClass]="pedido.statusKey">{{ pedido.status }}</div>
          </div>
          <div class="datas">
            <div><span class="label">Criado</span> <span class="value">{{ pedido.criadoEm | date:'short' }}</span></div>
            <div><span class="label">Atualizado</span> <span class="value">{{ pedido.atualizadoEm | date:'short' }}</span></div>
          </div>
        </div>

        <div class="timeline" *ngIf="pedido.timeline?.length">
          <div class="step" *ngFor="let s of pedido.timeline" [class.done]="s.done">
            <div class="dot"></div>
            <div class="name">{{ s.step }}</div>
            <div class="date" *ngIf="s.date">{{ s.date | date:'short' }}</div>
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <h3>Cliente</h3>
            <p><strong>Nome:</strong> {{ pedido.cliente?.nome }}</p>
            <p><strong>CPF:</strong> {{ pedido.cliente?.cpf }}</p>
            <p><strong>Telefone:</strong> {{ pedido.cliente?.telefone }}</p>
            <p><strong>Email:</strong> {{ pedido.cliente?.email }}</p>
          </div>

          <div class="card">
            <h3>Pet</h3>
            <p><strong>Nome:</strong> {{ pedido.pet?.nome }}</p>
            <p><strong>Espécie:</strong> {{ pedido.pet?.especie }} <span *ngIf="pedido.pet?.raca">({{ pedido.pet?.raca }})</span></p>
            <p><strong>Peso:</strong> {{ pedido.pet?.pesoKg }} kg</p>
            <p><strong>Idade:</strong> {{ pedido.pet?.idadeAnos }} anos</p>
            <p><strong>Sexo:</strong> {{ pedido.pet?.sexo }}</p>
            <div *ngIf="alergiasToList(pedido.pet?.alergias).length" class="pet-allergies-badge">
              <span class="label">Alergias:</span>
              <span class="chip" *ngFor="let a of alergiasToList(pedido.pet?.alergias)">{{ a }}</span>
            </div>
          </div>

          <div class="card">
            <h3>Veterinário</h3>
            <p><strong>Nome:</strong> {{ pedido.veterinario?.nome }}</p>
            <p><strong>CRMV:</strong> {{ pedido.veterinario?.crmv }}</p>
            <p *ngIf="pedido.veterinario?.telefone"><strong>Telefone:</strong> {{ pedido.veterinario?.telefone }}</p>
            <p *ngIf="pedido.veterinario?.email"><strong>Email:</strong> {{ pedido.veterinario?.email }}</p>
          </div>

          <div class="card">
            <h3>Pagamento & Entrega</h3>
            <p><strong>Método:</strong> {{ pedido.pagamento?.metodo }}</p>
            <p><strong>Status:</strong> {{ pedido.pagamento?.status }}</p>
            <p><strong>Total:</strong> R$ {{ pedido.pagamento?.valorTotal | number:'1.2-2' }}</p>
            <p><strong>Entrega:</strong> {{ pedido.entrega?.tipo }}</p>
            <p *ngIf="pedido.entrega?.prazo"><strong>Prazo:</strong> {{ pedido.entrega?.prazo }}</p>
          </div>
        </div>

        <div class="itens" *ngIf="pedido.itens?.length">
          <h3>Itens manipulados</h3>
          <div class="item" *ngFor="let it of pedido.itens">
            <div class="head">
              <div class="nome">{{ it.nome }}</div>
              <div class="forma">{{ it.forma }}</div>
            </div>
            <div class="linhas">
              <div *ngIf="it.concentracao"><strong>Concentração:</strong> {{ it.concentracao }}</div>
              <div *ngIf="it.volumeMl"><strong>Volume:</strong> {{ it.volumeMl }} mL</div>
              <div *ngIf="it.quantidade"><strong>Quantidade:</strong> {{ it.quantidade }}</div>
              <div *ngIf="it.dosagem"><strong>Dosagem:</strong> {{ it.dosagem }}</div>
              <div><strong>Posologia:</strong> {{ it.posologia }}</div>
            </div>
            <div class="comp" *ngIf="it.componentes?.length">
              <div class="comp-title">Componentes</div>
              <ul>
                <li *ngFor="let c of it.componentes">
                  <span>{{ c.ativo }}</span>
                  <span class="qtd">{{ c.quantidade }}</span>
                </li>
              </ul>
            </div>
            <div class="obs" *ngIf="it.observacoes"><em>{{ it.observacoes }}</em></div>
          </div>
        </div>
      </div>

      <div class="vazio" *ngIf="consultado && !pedido && !carregando">
        Nenhum pedido encontrado para o código informado.
      </div>
    </div>
  `,
  styles: `
    :host{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Liberation Sans', sans-serif; }
    *, *::before, *::after{ box-sizing: border-box }
    .modal-overlay{ position:fixed; inset:0; background:rgba(0,0,0,.6); animation:fadeIn .12s ease; z-index: 999; }
    .modal-content{ position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#1f2a38; color:#ecf0f5; width:92%; max-width:720px; padding:22px; border-radius:14px; box-shadow:0 12px 28px rgba(0,0,0,.5); animation:popIn .12s ease; z-index: 1000; max-height:85vh; overflow-y:auto; -webkit-overflow-scrolling:touch; }
  .modal-header{ display:flex; align-items:center; justify-content:space-between; margin-bottom:14px }
  .modal-header h2{ font-size:20px; font-weight:700; margin:0; }
    .btn-close{ background:#2a364a; color:#fff; border:1px solid rgba(255,255,255,.08); border-radius:10px; padding:6px 10px; cursor:pointer }
  .form{ display:flex; gap:12px; align-items:end; margin-bottom:18px; max-width:100% }
    .field{ flex:1 }
    label{ display:block; font-weight:600; margin-bottom:6px }
  input{ display:block; width:100%; max-width:100%; padding:10px 12px; border-radius:10px; border:1px solid rgba(255,255,255,.1); background:#142033; color:#ecf0f5 }
    button[type=submit]{ padding:10px 16px; border-radius:10px; border:none; background:var(--primary); color:#fff; font-weight:700; cursor:pointer }
    .resultado{ background:#182439; border-radius:12px; padding:14px; box-shadow:0 6px 12px rgba(0,0,0,.35) }
    .top{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px }
    .pedido-id{ display:flex; gap:10px; align-items:center }
  .codigo{ font-weight:800; font-size:16px; color:#fff }
  .badge{ padding:3px 10px; border-radius:999px; font-weight:700; font-size:12px; background:#2a364a; color:#cde4ff; white-space:nowrap }
    .badge.em-manipulacao{ background:#2b3446; color:#9bd0ff }
    .badge.recebido{ background:#20323e; color:#bfe3ff }
    .badge.pronto{ background:#284133; color:#aff0c8 }
    .badge.disponivel{ background:#3b2f48; color:#e1b8ff }
    .datas .label{ color:#aeb6c2; margin-right:6px }
    .datas .value{ font-weight:700 }
    .timeline{ display:flex; gap:14px; padding:10px 6px; background:#142033; border-radius:10px; margin-bottom:12px; overflow:auto }
    .step{ display:flex; flex-direction:column; align-items:center; min-width:120px; color:#aeb6c2 }
    .step .dot{ width:10px; height:10px; border-radius:50%; background:#5a6b82; margin-bottom:6px }
    .step.done .dot{ background:#31c48d }
  .step .name{ font-weight:600; color:#d5dbe5; margin-bottom:2px; text-align:center; font-size:14px }
  .step .date{ font-size:12px; opacity:.9 }
    .grid{ display:grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap:10px; margin:10px 0 }
  .card{ background:#142033; border-radius:10px; padding:12px; border:1px solid rgba(255,255,255,.06) }
  .pet-allergies-badge{ display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-top:6px }
  .pet-allergies-badge .label{ font-weight:700; color:#ffcccc }
  .pet-allergies-badge .chip{ background:#ffe6e6; color:#8a1f1f; border:1px solid #ffcccc; padding:3px 8px; border-radius:999px; font-size:12px; }
  .card h3{ margin:0 0 8px; color:var(--primary); font-size:16px }
    .itens{ margin-top:12px }
  .itens h3{ margin:0 0 8px; color:var(--primary); font-size:16px }
    .item{ background:#142033; border:1px solid rgba(255,255,255,.06); border-radius:10px; padding:10px; margin-bottom:10px }
    .item .head{ display:flex; justify-content:space-between; gap:12px; margin-bottom:6px }
  .item .nome{ font-weight:800; color:#fff; font-size:15px }
  .item .forma{ color:#aeb6c2; font-size:13px }
  .linhas{ display:flex; flex-wrap:wrap; gap:10px; color:#dbe2ee; margin-bottom:6px; font-size:13px }
    .comp-title{ font-weight:700; margin:6px 0 }
    .comp ul{ list-style:none; padding:0; margin:0 }
    .comp li{ display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,.06) }
    .comp li:last-child{ border-bottom:none }
    .obs{ color:#aeb6c2 }
    .vazio{ opacity:.85; padding:8px 0 }
    @keyframes fadeIn{ from{opacity:0} to{opacity:1} }
    @keyframes popIn{ from{opacity:0; transform:translate(-50%,-52%) scale(.98)} to{opacity:1; transform:translate(-50%,-50%) scale(1)} }

    @media (max-width: 560px){
  .modal-content{ width:96%; padding:16px; }
      .form{ flex-direction:column; align-items:stretch; gap:8px }
  .field{ width:100% }
  input{ width:100%; max-width:100%; }
      button[type=submit]{ width:100%; }
      .top{ flex-direction:column; align-items:flex-start; gap:8px }
      /* Timeline: vertical layout on mobile (no horizontal scroll) */
      .timeline{
        display:flex;
        flex-direction:column;
        gap:12px;
        padding:10px 8px; /* simpler padding; avoid overlay */
        overflow:visible;
        position:relative;
      }
      .timeline::before{ display:none; content:none; }
      .step{
        min-width:0; /* allow shrink to container */
        align-items:flex-start;
        flex-direction:column;
        text-align:left;
        position:relative;
        padding-left:22px; /* room for the dot */
      }
      .step .dot{
        position:absolute;
        left:0; /* sit in the reserved padding */
        top:0.4em; /* align with first text line */
        width:10px;
        height:10px;
        border-radius:50%;
        box-shadow:none;
      }
      .step .name{ text-align:left; margin-bottom:2px; font-size:14px }
      .step .date{ text-align:left; font-size:12px }

      /* Header compaction */
      .pedido-id{ flex-direction:column; align-items:flex-start; gap:6px }
  .codigo{ font-size:15px }
  .badge{ font-size:11px; padding:3px 8px; }
      .datas{ font-size:12px }

      /* Items typography tweaks */
  .item .nome{ font-size:15px }
  .item .forma{ font-size:12px }
    }
  `
})
export class ConsultarPedidosComponent {
    @Input() modal: boolean = false; // when embedded inside another modal, skip its own overlay
    @Output() close = new EventEmitter<void>();
  codigo = '';
  carregando = false;
  consultado = false;
  pedido: any = null;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    private router: Router,
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  private get token(): string | null {
    return isPlatformBrowser(this.platformId) ? this.auth.getToken() : null;
  }

  consultar() {
    if (!this.codigo) return;
    this.carregando = true;
    this.consultado = true;
    this.pedido = null;
    const code = (this.codigo || '').trim().toUpperCase();
    if (code === 'FP-12345') {
      // Mock do pedido de farmácia de manipulação veterinária
      this.pedido = this.buildMockPedido(code);
      this.carregando = false;
      return;
    }
    // Fallback: Chamada via ApiService
    this.api.consultarPedido(code, this.token || undefined).subscribe({
      next: (res: any) => {
        this.pedido = res || null;
        if (!this.pedido) this.toast.info('Pedido não encontrado');
      },
      error: (err: any) => {
        const msg = (err?.error?.message) || (err?.error?.error) || err?.message || 'Erro ao consultar pedido';
        this.toast.error(msg, 'Erro');
        this.pedido = null;
      },
      complete: () => this.carregando = false
    });
  }

  fechar(){
    if (this.modal) {
      this.close.emit();
      return;
    }
    // Fecha o named outlet 'modal' relativo à rota pai (funciona tanto em /area-cliente quanto em /meus-pedidos)
    if (this.route && this.route.parent) {
      this.router.navigate([{ outlets: { modal: null } }], { relativeTo: this.route.parent });
    } else {
      // Fallback: volta para área do cliente
      this.router.navigateByUrl('/area-cliente');
    }
  }

  ngOnInit(){
    // Se vier via query param (?codigo=FP-12345), preencher e auto-consultar
    const qp = this.route.snapshot.queryParamMap;
    const codigo = (qp.get('codigo') || '').trim();
    if (codigo) {
      this.codigo = codigo;
      // pequeno defer para garantir render antes de consultar
      setTimeout(() => this.consultar());
    }
  }

  alergiasToList(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map(v => String(v).trim()).filter(Boolean);
    }
    return String(value).split(/[;,]/).map(s => s.trim()).filter(Boolean);
  }

  private buildMockPedido(codigo: string) {
    const now = new Date();
    const earlier = new Date(now.getTime() - 1000 * 60 * 60 * 24); // -1 dia
    const mid = new Date(now.getTime() - 1000 * 60 * 60 * 6); // -6 horas
    return {
      codigo,
      status: 'Em manipulação',
      statusKey: 'em-manipulacao',
      criadoEm: earlier.toISOString(),
      atualizadoEm: mid.toISOString(),
      cliente: {
        nome: 'Maria Oliveira',
        cpf: '111.111.111-11',
        telefone: '(11) 98888-7777',
        email: 'maria.oliveira@example.com'
      },
      pet: {
        nome: 'Rex',
        especie: 'Cachorro',
        raca: 'Labrador',
        pesoKg: 24.8,
        idadeAnos: 5,
        sexo: 'Macho',
        alergias: 'Nenhuma conhecida'
      },
      veterinario: {
        nome: 'Dr. João Silva',
        crmv: 'SP-12345',
        telefone: '(11) 95555-4444',
        email: 'joao.silva@vetclinic.com'
      },
      pagamento: {
        metodo: 'PIX',
        status: 'Aprovado',
        valorTotal: 189.9
      },
      entrega: {
        tipo: 'Retirada na loja',
        prazo: 'Hoje após as 17h'
      },
      timeline: [
        { step: 'Recebido', date: earlier.toISOString(), done: true },
        { step: 'Em análise', date: new Date(earlier.getTime() + 1000 * 60 * 90).toISOString(), done: true },
        { step: 'Em manipulação', date: mid.toISOString(), done: true },
        { step: 'Pronto', date: null, done: false },
        { step: 'Disponível para retirada', date: null, done: false }
      ],
      itens: [
        {
          nome: 'Suspensão de Metronidazol 50 mg/mL',
          forma: 'Suspensão oral',
          volumeMl: 100,
          concentracao: '50 mg/mL',
          posologia: '5 mL a cada 12 horas por 7 dias',
          observacoes: 'Agitar antes de usar. Manter refrigerado (2–8°C).',
          componentes: [
            { ativo: 'Metronidazol', quantidade: '5 g' },
            { ativo: 'Veículo oral sabor frango', quantidade: 'QS 100 mL' }
          ]
        },
        {
          nome: 'Cápsulas de Fluoxetina 10 mg',
          forma: 'Cápsulas gelatinosas',
          quantidade: 30,
          dosagem: '10 mg',
          posologia: '1 cápsula ao dia por 30 dias',
          observacoes: 'Administrar com alimento.',
          componentes: [
            { ativo: 'Fluoxetina HCl', quantidade: '300 mg' },
            { ativo: 'Excipiente para cápsula', quantidade: 'QS 30 cápsulas' }
          ]
        }
      ]
    };
  }
}
