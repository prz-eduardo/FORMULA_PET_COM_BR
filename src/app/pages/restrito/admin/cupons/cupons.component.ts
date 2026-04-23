import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { catchError, map } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import { AdminPaginationComponent } from '../shared/admin-pagination/admin-pagination.component';
import { ButtonDirective, ButtonComponent } from '../../../../shared/button';
import { AdminApiService, CupomDto, CupomPayload, Paged, PessoaDto, ProdutoDto } from '../../../../services/admin-api.service';
import { AdminCrudComponent } from '../../../../shared/admin-crud/admin-crud.component';
import { AdminListingComponent } from '../../../../shared/admin-listing/admin-listing.component';
import { SideDrawerComponent } from '../../../../shared/side-drawer/side-drawer.component';
import { EntityLookupComponent } from '../../../../shared/entity-lookup/entity-lookup.component';

type LookupItem = { id: number; name: string };
type PessoaVinc = { pessoa_tipo: 'cliente' | 'vet' | 'admin'; pessoa_id: number; nome?: string | null; email?: string | null };

@Component({
  selector: 'app-admin-cupons',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, AdminPaginationComponent, ButtonDirective, ButtonComponent, AdminListingComponent, SideDrawerComponent, AdminCrudComponent, EntityLookupComponent],
  templateUrl: './cupons.component.html',
  styleUrls: ['./cupons.component.scss']
})
export class CuponsAdminComponent implements OnInit {
  q = signal('');
  active = signal<'all' | '1' | '0'>('all');
  page = signal(1);
  pageSize = signal(10);
  total = signal(0);
  items = signal<CupomDto[]>([]);
  loading = signal(false);
  submitting = signal(false);

  selected = signal<CupomDto | null>(null);
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

  selectedProdutoItems: LookupItem[] = [];
  selectedCategoriaItems: LookupItem[] = [];
  selectedTagItems: LookupItem[] = [];
  pessoaVinculos: PessoaVinc[] = [];
  pessoaQ = '';
  pessoaSugestoes: PessoaDto[] = [];
  private pessoaSearchTimer: ReturnType<typeof setTimeout> | null = null;

  private catMeta: LookupItem[] = [];
  private tagMeta: LookupItem[] = [];

  constructor(private api: AdminApiService, private fb: FormBuilder) {}

  ngOnInit(): void {
    this.resetCupomForm();
    this.api.produtosMeta().subscribe({
      next: m => {
        this.catMeta = (m.categorias || []).map(c => ({ id: Number(c.id), name: String(c.name || '') }));
        this.tagMeta = (m.tags || []).map(t => ({ id: Number(t.id), name: String(t.name || '') }));
      },
      error: () => {}
    });
    this.load();
  }

  searchProdutosFn = (q: string) =>
    this.api.listProdutos({ q, pageSize: 15 }).pipe(
      map((r: Paged<ProdutoDto>) =>
        (r.data || []).map(p => ({ id: Number(p.id), name: (p as any).nome || (p as any).name || 'Produto #' + p.id }))
      )
    );

  searchCategoriasFn = (q: string) => {
    const t = (q || '').toLowerCase().trim();
    const list = !t ? this.catMeta : this.catMeta.filter(c => c.name.toLowerCase().includes(t));
    return of(list.slice(0, 30).map(c => ({ id: c.id, name: c.name })));
  };

  searchTagsFn = (q: string) => {
    const t = (q || '').toLowerCase().trim();
    const list = !t ? this.tagMeta : this.tagMeta.filter(c => c.name.toLowerCase().includes(t));
    return of(list.slice(0, 30).map(c => ({ id: c.id, name: c.name })));
  };

  onProdutoItemsChange(items: Array<{ id: number; name?: string }> | undefined) {
    this.selectedProdutoItems = (items || []).map(x => ({ id: Number(x.id), name: String(x.name || '#' + x.id) }));
    this.cupomForm.patchValue({ produto_ids: this.selectedProdutoItems.map(s => s.id) });
  }

  onCategoriaItemsChange(items: Array<{ id: number; name?: string }> | undefined) {
    this.selectedCategoriaItems = (items || []).map(x => ({ id: Number(x.id), name: String(x.name || '#' + x.id) }));
    this.cupomForm.patchValue({ categoria_ids: this.selectedCategoriaItems.map(s => s.id) });
  }

  onTagItemsChange(items: Array<{ id: number; name?: string }> | undefined) {
    this.selectedTagItems = (items || []).map(x => ({ id: Number(x.id), name: String(x.name || '#' + x.id) }));
    this.cupomForm.patchValue({ tag_ids: this.selectedTagItems.map(s => s.id) });
  }

  onPessoaInput(ev: Event) {
    const v = (ev.target as HTMLInputElement | null)?.value || '';
    this.pessoaQ = v;
    if (this.pessoaSearchTimer) clearTimeout(this.pessoaSearchTimer);
    this.pessoaSearchTimer = setTimeout(() => this.runPessoaSearch(), 280);
  }

  private runPessoaSearch() {
    const q = (this.pessoaQ || '').trim();
    if (!q) {
      this.pessoaSugestoes = [];
      return;
    }
    this.api.listPeople({ q, pageSize: 12 }).subscribe({
      next: (res: Paged<PessoaDto>) => (this.pessoaSugestoes = res.data || []),
      error: () => (this.pessoaSugestoes = [])
    });
  }

  addPessoaVinculo(s: PessoaDto) {
    const tipo = (s.tipo || 'cliente') as PessoaVinc['pessoa_tipo'];
    const id = Number(s.id);
    if (!Number.isFinite(id) || id <= 0) return;
    if (this.pessoaVinculos.some(p => p.pessoa_tipo === tipo && p.pessoa_id === id)) return;
    this.pessoaVinculos = [
      ...this.pessoaVinculos,
      { pessoa_tipo: tipo, pessoa_id: id, nome: s.nome || s.name || null, email: s.email }
    ];
    this.pessoaQ = '';
    this.pessoaSugestoes = [];
  }

  removePessoaVinculo(row: PessoaVinc) {
    this.pessoaVinculos = this.pessoaVinculos.filter(
      p => !(p.pessoa_tipo === row.pessoa_tipo && p.pessoa_id === row.pessoa_id)
    );
  }

  labelPessoaVinc(p: PessoaVinc) {
    const n = p.nome || p.email || 'Pessoa';
    return n + ' (' + p.pessoa_tipo + ' #' + p.pessoa_id + ')';
  }

  private hydrateTaxonomiaVinculos(c: CupomDto) {
    const pids = (c.produto_ids || []).map(x => Number(x)).filter(n => Number.isFinite(n) && n > 0);
    const cids = (c.categoria_ids || []).map(x => Number(x)).filter(n => Number.isFinite(n) && n > 0);
    const tids = (c.tag_ids || []).map(x => Number(x)).filter(n => Number.isFinite(n) && n > 0);
    this.selectedCategoriaItems = cids.map(id => {
      const m = this.catMeta.find(x => x.id === id);
      return { id, name: m?.name || 'Categoria #' + id };
    });
    this.selectedTagItems = tids.map(id => {
      const m = this.tagMeta.find(x => x.id === id);
      return { id, name: m?.name || 'Tag #' + id };
    });
    this.cupomForm.patchValue({ produto_ids: pids, categoria_ids: cids, tag_ids: tids });
    if (!pids.length) {
      this.selectedProdutoItems = [];
      return;
    }
    forkJoin(
      pids.map(id =>
        this.api.getProduto(id).pipe(
          map(p => ({ id, name: (p as any).nome || (p as any).name || 'Produto #' + id })),
          catchError(() => of({ id, name: 'Produto #' + id }))
        )
      )
    ).subscribe(arr => (this.selectedProdutoItems = arr));
  }

  resetCupomForm(item?: CupomDto | null) {
    const it: any = item || {};
    this.selectedProdutoItems = [];
    this.selectedCategoriaItems = [];
    this.selectedTagItems = [];
    this.pessoaVinculos = [];
    this.pessoaQ = '';
    this.pessoaSugestoes = [];
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
      usado: [it.usado ?? 0],
      produto_ids: [[] as number[]],
      categoria_ids: [[] as number[]],
      tag_ids: [[] as number[]]
    });
    if (item?.id) {
      this.hydrateTaxonomiaVinculos(item);
      const pv = (item as any).pessoa_vinculos;
      if (Array.isArray(pv) && pv.length) {
        this.pessoaVinculos = pv
          .map((r: any) => ({
            pessoa_tipo: (r.pessoa_tipo || r.tipo || 'cliente') as PessoaVinc['pessoa_tipo'],
            pessoa_id: Number(r.pessoa_id),
            nome: r.nome || null,
            email: r.email || null
          }))
          .filter((p: PessoaVinc) => Number.isFinite(p.pessoa_id) && p.pessoa_id > 0);
      }
    }
  }

  load() {
    this.loading.set(true);
    const params: any = { q: this.q(), page: this.page(), pageSize: this.pageSize() };
    if (this.active() !== 'all') params.active = this.active() === '1' ? 1 : 0;
    this.api.listCupons(params).subscribe({
      next: (res: Paged<CupomDto>) => {
        const list = (res.data || []).map((it: any) => ({
          ...it,
          valorLabel: it.tipo === 'percentual' ? it.valor + '%' : it.frete_gratis ? 'Frete grátis' : 'R$ ' + it.valor,
          ativoLabel: (it.ativo ?? 1) === 1 ? 'Ativo' : 'Inativo'
        }));
        this.items.set(list as any);
        this.total.set(res.total || 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onQ(ev: Event) {
    const el = ev.target as HTMLInputElement | null;
    if (el) {
      this.q.set(el.value);
      this.page.set(1);
      this.load();
    }
  }
  onActive(ev: Event) {
    const el = ev.target as HTMLSelectElement | null;
    if (el) {
      this.active.set(el.value as any);
      this.page.set(1);
      this.load();
    }
  }
  totalPages() {
    const s = this.pageSize();
    const t = this.total();
    return s ? Math.max(1, Math.ceil(t / s)) : 1;
  }
  canPrev() {
    return this.page() > 1;
  }
  canNext() {
    return this.page() < this.totalPages();
  }
  prev() {
    if (this.canPrev()) {
      this.page.set(this.page() - 1);
      this.load();
    }
  }
  next() {
    if (this.canNext()) {
      this.page.set(this.page() + 1);
      this.load();
    }
  }

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

  onDrawerOpenChange(open: boolean) {
    if (!open) this.closeDrawer();
  }

  submitCupom() {
    if (this.cupomForm.invalid) {
      this.cupomForm.markAllAsTouched();
      return;
    }
    const raw: any = { ...this.cupomForm.getRawValue() };
    const pessoa_vinculos = this.pessoaVinculos.map(p => ({ pessoa_tipo: p.pessoa_tipo, pessoa_id: p.pessoa_id }));
    if (raw.produto_ids && !Array.isArray(raw.produto_ids)) raw.produto_ids = [];
    if (raw.categoria_ids && !Array.isArray(raw.categoria_ids)) raw.categoria_ids = [];
    if (raw.tag_ids && !Array.isArray(raw.tag_ids)) raw.tag_ids = [];
    const body: any = { ...raw, pessoa_vinculos } as CupomPayload;
    body.valor = Number(body.valor || 0);
    if (body.valor_minimo != null && body.valor_minimo !== '') body.valor_minimo = Number(body.valor_minimo);
    if (body.desconto_maximo != null && body.desconto_maximo !== '') body.desconto_maximo = Number(body.desconto_maximo);
    body.primeira_compra = Number(body.primeira_compra) ? 1 : 0;
    body.frete_gratis = Number(body.frete_gratis) ? 1 : 0;
    body.cumulativo_promo = Number(body.cumulativo_promo) ? 1 : 0;
    body.ativo = Number(body.ativo) ? 1 : 0;
    body.usado = Number(body.usado || 0);

    const current = this.selected();
    this.submitting.set(true);
    const req$ = current?.id ? this.api.updateCupom(current.id, body) : this.api.createCupom(body);

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
    this.api.deleteCupom(s.id).subscribe(() => {
      this.closeDrawer();
      this.load();
    });
  }

  validar(codigo: string) {
    if (!codigo) return;
    this.api.validarCupom({ codigo }).subscribe(
      (res: any) => {
        alert(res?.message || (res?.ok ? 'Validação OK' : 'Cupom inválido'));
      },
      () => alert('Erro ao validar cupom')
    );
  }
}
