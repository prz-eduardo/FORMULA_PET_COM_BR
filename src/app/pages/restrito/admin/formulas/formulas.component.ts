import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators, FormArray } from '@angular/forms';
import { AdminPaginationComponent } from '../shared/admin-pagination/admin-pagination.component';
import { AdminCrudComponent } from '../../../../shared/admin-crud/admin-crud.component';
import {
  AdminApiService,
  FormulaDto,
  FormulaItemDto,
  ProductFormDto,
  UnitDto
} from '../../../../services/admin-api.service';

/**
 * FormulasAdminComponent
 * ------------------------------------------------------------
 * CRUD padronizado de fórmulas de manipulação. Usa o shell
 * `app-admin-page` (listing + drawer), com filtros rápidos,
 * busca com debounce e formulário consistente com o restante da
 * área administrativa.
 *
 * O payload de criação/edição envia:
 *   name, form_id, output_unit_code, dose_amount, dose_unit_code,
 *   price, notes, active + itens.
 */
@Component({
  selector: 'app-admin-formulas',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AdminPaginationComponent, AdminCrudComponent],
  templateUrl: './formulas.component.html',
  styleUrls: ['./formulas.component.scss']
})
export class FormulasAdminComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(AdminApiService);

  // Metadados carregados via /config-new-product
  units: UnitDto[] = [];
  forms: ProductFormDto[] = [];
  ativosAll: Array<{ id: number | string; nome: string; descricao?: string }> = [];

  // Formulário principal da fórmula
  form = this.fb.group({
    id: [null as number | null],
    name: ['', Validators.required],
    form_id: [null as number | null, Validators.required],
    output_unit_code: ['', Validators.required],
    dose_amount: [null as number | null],
    dose_unit_code: [null as string | null],
    price: [null as number | null],
    notes: [''],
    active: [1 as 0 | 1]
  });

  itemsFA = this.fb.array([]);

  // Listagem / filtros
  filterQ = signal('');
  filterActive = signal<'all' | '1' | '0'>('all');
  filterFormId = signal<number | null>(null);
  page = signal(1);
  pageSize = signal(10);
  rows = signal<Array<FormulaDto & { estimate?: { producible_units: number } }>>([]);
  total = signal(0);
  totalPages = signal(0);
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);

  // 0 = listagem, 1 = drawer aberto (cadastro/edição + itens)
  step = signal(0);

  // Busca de ativos por item (autocomplete)
  itemAtivoQueries: string[] = [];
  itemSugestoes: Array<Array<{ id: number | string; ativo_nome: string }>> = [];

  hasFilters = computed(() =>
    this.filterQ() !== '' || this.filterActive() !== 'all' || this.filterFormId() !== null
  );

  ngOnInit() {
    this.api.getConfigNewProduct().subscribe({
      next: (res) => {
        this.forms = res.forms || [];
        this.units = res.units || [];
        this.ativosAll = Array.isArray(res.ativos) ? res.ativos.map((a: any) => ({ id: a.id, nome: a.nome })) : [];
      },
      error: () => { this.forms = []; this.units = []; this.ativosAll = []; }
    });
    this.loadRows();
  }

  // ---------- Helpers de UI ----------
  getFormName(id: number | undefined | null): string | null {
    if (!id) return null;
    const f = (this.forms || []).find(x => x.id === id);
    return f ? f.name : null;
  }

  onItemAtivoQueryChange(i: number, q: string) {
    this.itemAtivoQueries[i] = q;
    const term = (q || '').trim().toLowerCase();
    if (!term) { this.itemSugestoes[i] = []; return; }
    const list = (this.ativosAll || [])
      .filter(a => (a.nome || '').toLowerCase().includes(term) || ((a as any).descricao || '').toLowerCase().includes(term))
      .slice(0, 20)
      .map(a => ({ id: a.id as any, ativo_nome: (a as any).nome }));
    this.itemSugestoes[i] = list;
  }
  selecionarItemAtivo(i: number, op: { id: number | string; ativo_nome: string }) {
    const ctl: any = this.items.at(i);
    if (ctl) ctl.patchValue({ ativo_id: op.id });
    this.itemAtivoQueries[i] = op.ativo_nome;
    this.itemSugestoes[i] = [];
  }
  getAtivoNomeById(id: number | string | null | undefined): string | null {
    if (id == null) return null;
    const a = (this.ativosAll || []).find(x => String(x.id) === String(id));
    return a?.nome || null;
  }

  // ---------- Listagem ----------
  loadRows() {
    this.loading.set(true);
    const params: any = {
      q: this.filterQ() || undefined,
      page: this.page(),
      pageSize: this.pageSize()
    };
    if (this.filterActive() === '1') params.active = 1;
    if (this.filterActive() === '0') params.active = 0;
    if (this.filterFormId() != null) params.form_id = this.filterFormId();
    this.api.listFormulas(params).subscribe({
      next: (res) => {
        this.rows.set(res.data || []);
        this.total.set(res.total || 0);
        this.totalPages.set(res.totalPages || 0);
        this.loading.set(false);
      },
      error: () => { this.rows.set([]); this.total.set(0); this.loading.set(false); }
    });
  }

  onQuickSearch(value: string) {
    this.filterQ.set((value || '').trim());
    this.page.set(1);
    this.loadRows();
  }

  setActiveFilter(v: 'all' | '1' | '0') {
    if (this.filterActive() === v) return;
    this.filterActive.set(v);
    this.page.set(1);
    this.loadRows();
  }

  setFormFilter(v: string) {
    const num = v ? Number(v) : null;
    this.filterFormId.set(num);
    this.page.set(1);
    this.loadRows();
  }

  clearFilters() {
    this.filterQ.set('');
    this.filterActive.set('all');
    this.filterFormId.set(null);
    this.page.set(1);
    this.loadRows();
  }

  // ---------- CRUD ----------
  newFormula() {
    this.form.reset({ active: 1, form_id: null, output_unit_code: '' });
    this.itemsFA.clear();
    this.itemAtivoQueries = [];
    this.itemSugestoes = [];
    this.error.set(null);
    this.step.set(1);
  }

  editFormula(f: FormulaDto) {
    const id = f.id as any;
    this.form.patchValue({
      id: id ?? null,
      name: f.name,
      form_id: (f.form_id as any) ?? null,
      output_unit_code: f.output_unit_code || '',
      dose_amount: (f.dose_amount as any) ?? null,
      dose_unit_code: (f.dose_unit_code as any) ?? null,
      price: (f.price as any) ?? null,
      notes: (f.notes as any) ?? '',
      active: (f.active as any) ? 1 : 0
    });
    this.itemsFA.clear();
    this.itemAtivoQueries = [];
    this.itemSugestoes = [];
    if (id) {
      this.api.getFormula(id).subscribe({
        next: (det) => {
          this.itemsFA.clear();
          const list = (det as any).items || (det as any).itens || [];
          list.forEach((it: any) => {
            const g = this.fb.group({
              tipo: [it.tipo, Validators.required],
              ativo_id: [it.ativo_id ?? it.ativoId ?? null],
              insumo_nome: [it.insumo_nome ?? ''],
              quantity: [it.quantity ?? it.quantidade ?? null, Validators.required],
              unit_code: [it.unit_code ?? it.unit ?? '', Validators.required]
            });
            this.items.push(g);
          });
        },
        error: () => {}
      });
    }
    this.error.set(null);
    this.step.set(1);
  }

  // ---------- Itens ----------
  get items() { return this.itemsFA as unknown as FormArray; }
  addItem(tipo: 'ativo' | 'insumo') {
    const g = this.fb.group({
      tipo: [tipo, Validators.required],
      ativo_id: [null as number | null],
      insumo_nome: [''],
      quantity: [null as number | null, Validators.required],
      unit_code: ['', Validators.required]
    });
    this.items.push(g);
    this.itemAtivoQueries.push('');
    this.itemSugestoes.push([]);
  }
  removeItem(i: number) {
    this.items.removeAt(i);
    this.itemAtivoQueries.splice(i, 1);
    this.itemSugestoes.splice(i, 1);
  }

  private validateItems(): { valid: boolean; message?: string } {
    const n = this.items.length;
    if (n === 0) return { valid: true };
    for (let i = 0; i < n; i++) {
      const v: any = (this.items.at(i) as any).value;
      if (!v || !v.tipo) return { valid: false, message: `Item ${i + 1}: selecione o tipo.` };
      if (v.quantity == null || Number(v.quantity) <= 0) return { valid: false, message: `Item ${i + 1}: informe uma quantidade válida.` };
      if (!v.unit_code) return { valid: false, message: `Item ${i + 1}: selecione a unidade.` };
      if (v.tipo === 'ativo' && !v.ativo_id) return { valid: false, message: `Item ${i + 1}: selecione um ativo.` };
      if (v.tipo === 'insumo' && !(v.insumo_nome || '').trim()) return { valid: false, message: `Item ${i + 1}: informe o nome do insumo.` };
    }
    return { valid: true };
  }

  private buildItemsPayload(): FormulaItemDto[] {
    return this.items.controls.map((c: any) => {
      const v = c.value;
      const it: FormulaItemDto = {
        tipo: v.tipo,
        quantity: Number(v.quantity),
        unit_code: String(v.unit_code)
      };
      if (v.tipo === 'ativo') it.ativo_id = Number(v.ativo_id);
      else it.insumo_nome = String(v.insumo_nome || '');
      return it;
    });
  }

  private toNumOrNull(v: any): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  private buildFormulaBody(): Partial<FormulaDto> {
    const v = this.form.value;
    return {
      id: (v.id as any) ?? undefined,
      name: v.name!,
      form_id: Number(v.form_id),
      output_unit_code: String(v.output_unit_code),
      output_quantity_per_batch: null,
      dose_amount: this.toNumOrNull(v.dose_amount),
      dose_unit_code: v.dose_unit_code || null,
      price: this.toNumOrNull(v.price),
      notes: (v.notes as any) || null,
      active: (v.active as any) ? 1 : 0
    };
  }

  saveAll() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Preencha os campos obrigatórios: nome, forma e unidade de saída.');
      return;
    }
    const hasItems = this.items.length > 0;
    if (hasItems) {
      const chk = this.validateItems();
      if (!chk.valid) { this.error.set(chk.message || 'Itens inválidos.'); return; }
    }

    this.error.set(null); this.saving.set(true);
    const body = this.buildFormulaBody();
    const idExisting = this.form.value.id as any;
    const items = hasItems ? this.buildItemsPayload() : [];
    const done = () => { this.saving.set(false); };

    const afterFormula = (id: number | string) => {
      if (!hasItems) { done(); this.step.set(0); this.loadRows(); return; }
      this.api.updateFormulaItems(id, items).subscribe({
        next: () => { done(); this.step.set(0); this.loadRows(); },
        error: () => { done(); this.error.set('Falha ao salvar os itens.'); }
      });
    };

    if (idExisting) {
      this.api.updateFormula(idExisting, body).subscribe({
        next: () => afterFormula(Number(idExisting)),
        error: () => { done(); this.error.set('Falha ao salvar fórmula.'); }
      });
    } else {
      const createBody: any = hasItems ? { ...body, items } : body;
      this.api.createFormula(createBody as any).subscribe({
        next: (res) => {
          const newId = (res as any).id;
          this.form.patchValue({ id: newId });
          // Se havia itens, o backend já persistiu via payload. Finaliza.
          done();
          this.step.set(0);
          this.loadRows();
        },
        error: (err) => {
          done();
          const msg = err?.error?.error || 'Falha ao criar a fórmula.';
          this.error.set(msg);
        }
      });
    }
  }

  onDrawerOpenChange(open: boolean) {
    if (!open) {
      this.step.set(0);
      this.form.reset({ active: 1 });
      this.itemsFA.clear();
      this.itemAtivoQueries = [];
      this.itemSugestoes = [];
      this.error.set(null);
    }
  }
}
