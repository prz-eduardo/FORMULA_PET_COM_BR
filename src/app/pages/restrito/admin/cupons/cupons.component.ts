import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminPaginationComponent } from '../shared/admin-pagination/admin-pagination.component';
import { ButtonDirective, ButtonComponent } from '../../../../shared/button';
import { AdminApiService, CupomDto, CupomPayload, Paged } from '../../../../services/admin-api.service';
import { AdminCrudComponent } from '../../../../shared/admin-crud/admin-crud.component';
import { AdminListingComponent } from '../../../../shared/admin-listing/admin-listing.component';
import { SideDrawerComponent } from '../../../../shared/side-drawer/side-drawer.component';

@Component({
  selector: 'app-admin-cupons',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, AdminPaginationComponent, ButtonDirective, ButtonComponent, AdminListingComponent, SideDrawerComponent, AdminCrudComponent],
  templateUrl: './cupons.component.html',
  styleUrls: ['./cupons.component.scss']
})
export class CuponsAdminComponent implements OnInit {
  q = signal('');
  active = signal<'all'|'1'|'0'>('all');
  page = signal(1);
  pageSize = signal(10);
  total = signal(0);
  items = signal<CupomDto[]>([]);
  loading = signal(false);
  submitting = signal(false);

  selected = signal<CupomDto|null>(null);
  showCreate = signal(false);

  cupomForm!: FormGroup;
  drawerOpen = computed(() => this.selected() !== null || this.showCreate());

  cuponsColumns = [
    { key: 'codigo', label: 'Código' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'tipo', label: 'Tipo', width: '120px' },
    { key: 'valorLabel', label: 'Valor', width: '120px' },
    { key: 'validade', label: 'Validade', width: '140px' },
    { key: 'ativoLabel', label: 'Ativo', width: '90px' },
    { key: 'usado', label: 'Usado', width: '80px' }
  ];

  constructor(private api: AdminApiService, private fb: FormBuilder) {}

  ngOnInit(): void {
    this.resetCupomForm();
    this.load();
  }

  /** Cria/reseta o FormGroup. Se `item` for informado, popula com os dados. */
  resetCupomForm(item?: CupomDto | null) {
    const it: any = item || {};
    this.cupomForm = this.fb.group({
      codigo: [it.codigo || '', [Validators.required, Validators.minLength(2)]],
      descricao: [it.descricao || ''],
      tipo: [it.tipo || 'percentual', Validators.required],
      valor: [it.valor ?? 0, [Validators.required]],
      valor_minimo: [it.valor_minimo ?? null],
      desconto_maximo: [it.desconto_maximo ?? null],
      primeira_compra: [it.primeira_compra ?? 0],
      frete_gratis: [it.frete_gratis ?? 0],
      cumulativo_promo: [Number(it.cumulativo_promo ?? 0) ? 1 : 0],
      ativo: [it.ativo ?? 1],
      validade: [it.validade || ''],
      max_uso: [it.max_uso ?? null],
      limite_por_cliente: [it.limite_por_cliente ?? 1],
      restricoes_json: [it.restricoes_json || ''],
      usado: [it.usado ?? 0],
      produto_ids_csv: [this.idsToCsv(it.produto_ids)],
      categoria_ids_csv: [this.idsToCsv(it.categoria_ids)],
      tag_ids_csv: [this.idsToCsv(it.tag_ids)]
    });
  }

  private parseIdsCsv(v: any): number[] {
    if (!v) return [];
    if (Array.isArray(v)) return v.map((x: any) => Number(x)).filter((n: number) => Number.isFinite(n) && n > 0);
    return String(v).split(',').map(s => Number(String(s).trim())).filter(n => Number.isFinite(n) && n > 0);
  }

  private idsToCsv(v: any): string {
    if (!Array.isArray(v)) return '';
    return v.map(x => Number(x)).filter(n => Number.isFinite(n) && n > 0).join(', ');
  }

  load() {
    this.loading.set(true);
    const params: any = { q: this.q(), page: this.page(), pageSize: this.pageSize() };
    if (this.active() !== 'all') params.active = this.active() === '1' ? 1 : 0;
    this.api.listCupons(params).subscribe({
      next: (res: Paged<CupomDto>) => {
        const list = (res.data || []).map((it: any) => ({
          ...it,
          valorLabel: it.tipo === 'percentual' ? `${it.valor}%` : (it.frete_gratis ? 'Frete grátis' : `R$ ${it.valor}`),
          ativoLabel: (it.ativo ?? 1) === 1 ? 'Ativo' : 'Inativo'
        }));
        this.items.set(list as any);
        this.total.set(res.total || 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onQ(ev: Event) { const el = ev.target as HTMLInputElement|null; if (el) { this.q.set(el.value); this.page.set(1); this.load(); } }
  onActive(ev: Event) { const el = ev.target as HTMLSelectElement|null; if (el) { this.active.set(el.value as any); this.page.set(1); this.load(); } }
  totalPages() { const s=this.pageSize(); const t=this.total(); return s? Math.max(1, Math.ceil(t/s)) : 1; }
  canPrev() { return this.page()>1; }
  canNext() { return this.page()<this.totalPages(); }
  prev() { if (this.canPrev()) { this.page.set(this.page()-1); this.load(); } }
  next() { if (this.canNext()) { this.page.set(this.page()+1); this.load(); } }

  view(item: CupomDto) {
    this.selected.set(item);
    this.resetCupomForm(item);
    this.api.getCupom(item.id!).subscribe({
      next: (full: CupomDto) => {
        this.selected.set(full);
        this.resetCupomForm(full);
      },
      error: () => {}
    });
  }

  openCreate() {
    this.selected.set(null);
    this.showCreate.set(true);
    this.resetCupomForm();
  }

  closeDrawer() {
    this.selected.set(null);
    this.showCreate.set(false);
  }

  onDrawerOpenChange(open: boolean) { if (!open) this.closeDrawer(); }

  submitCupom() {
    if (this.cupomForm.invalid) { this.cupomForm.markAllAsTouched(); return; }
    const raw: any = { ...this.cupomForm.value };
    const produto_ids = this.parseIdsCsv(raw.produto_ids_csv);
    const categoria_ids = this.parseIdsCsv(raw.categoria_ids_csv);
    const tag_ids = this.parseIdsCsv(raw.tag_ids_csv);
    delete raw.produto_ids_csv; delete raw.categoria_ids_csv; delete raw.tag_ids_csv;
    const body: any = { ...raw, produto_ids, categoria_ids, tag_ids } as CupomPayload;
    body.valor = Number(body.valor || 0);
    if (body.valor_minimo != null && body.valor_minimo !== '') body.valor_minimo = Number(body.valor_minimo);
    if (body.desconto_maximo != null && body.desconto_maximo !== '') body.desconto_maximo = Number(body.desconto_maximo);
    body.primeira_compra = Number(body.primeira_compra) ? 1 : 0;
    body.frete_gratis = Number(body.frete_gratis) ? 1 : 0;
    body.cumulativo_promo = Number(body.cumulativo_promo) ? 1 : 0;
    body.ativo = Number(body.ativo) ? 1 : 0;
    body.usado = Number(body.usado || 0);
    if (body.restricoes_json) {
      try { JSON.parse(body.restricoes_json); } catch (e) { alert('restricoes_json inválido'); return; }
    }

    const current = this.selected();
    this.submitting.set(true);
    const req$ = current?.id
      ? this.api.updateCupom(current.id, body)
      : this.api.createCupom(body);

    req$.subscribe({
      next: (saved: any) => {
        this.submitting.set(false);
        this.closeDrawer();
        this.page.set(1);
        this.load();
        if (!current?.id) setTimeout(() => this.view(saved), 0);
      },
      error: () => {
        this.submitting.set(false);
      }
    });
  }

  remove(item: CupomDto | null) {
    const s = item || this.selected();
    if (!s?.id) return;
    if (!confirm('Remover cupom?')) return;
    this.api.deleteCupom(s.id).subscribe(() => { this.closeDrawer(); this.load(); });
  }

  validar(codigo: string) {
    if (!codigo) return;
    this.api.validarCupom({ codigo }).subscribe((res: any) => {
      alert(res?.message || (res?.ok ? 'Validação OK' : 'Cupom inválido'));
    }, () => alert('Erro ao validar cupom'));
  }
}
