import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators, FormArray } from '@angular/forms';
import { AdminApiService, FormulaDto, FormulaItemDto, ProductFormDto, UnitDto } from '../../../../services/admin-api.service';

@Component({
  selector: 'app-admin-formulas',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './formulas.component.html',
  styleUrls: ['./formulas.component.scss']
})
export class FormulasAdminComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(AdminApiService);

  // meta
  units: UnitDto[] = [];
  forms: ProductFormDto[] = [];
  ativosAll: Array<{ id: number | string; nome: string; descricao?: string }> = [];

  // criação/edição
  form = this.fb.group({
    id: [null as number | null],
    name: ['', Validators.required],
    form_id: [null as number | null, Validators.required],
    output_unit_code: ['', Validators.required],
    dose_amount: [null as number | null],
    dose_unit_code: [''],
    output_quantity_per_batch: [null as number | null],
    price: [null as number | null],
    notes: [''],
    active: [1 as 0 | 1]
  });

  itemsFA = this.fb.array([]);

  // tabela/listagem
  filterQ = signal('');
  page = signal(1);
  pageSize = signal(10);
  rows = signal<Array<FormulaDto & { estimate?: { producible_units: number } }>>([]);
  total = signal(0);
  totalPages = signal(0);
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  step = signal(0); // 0 listagem, 1 cadastro/edição, 2 itens
  // busca de ativo por item (como Estoque)
  itemAtivoQueries: string[] = [];
  itemSugestoes: Array<Array<{ id: number | string; ativo_nome: string }>> = [];

  ngOnInit() {
    // meta
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

  getFormName(id: number | undefined | null): string | null {
    if (!id) return null;
    const f = (this.forms || []).find(x => x.id === id);
    return f ? f.name : null;
  }

  // Helpers: busca/seleção de ativo por item
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

  // listagem
  loadRows() {
    this.loading.set(true);
    this.api.listFormulas({ includeEstimates: 1, q: this.filterQ() || undefined, page: this.page(), pageSize: this.pageSize() }).subscribe({
      next: (res) => { this.rows.set(res.data || []); this.total.set(res.total || 0); this.totalPages.set(res.totalPages || 0); this.loading.set(false); },
      error: () => { this.rows.set([]); this.loading.set(false); }
    });
  }
  changePage(delta: number) {
    const next = Math.max(1, Math.min((this.totalPages() || 1), this.page() + delta));
    if (next !== this.page()) { this.page.set(next); this.loadRows(); }
  }

  // criação/edição
  newFormula() { this.form.reset({ active: 1 }); this.itemsFA.clear(); this.step.set(1); }
  editFormula(f: FormulaDto) {
    const id = f.id as any;
    this.form.patchValue({
      id: id ?? null,
      name: f.name,
      form_id: f.form_id,
      output_unit_code: f.output_unit_code,
      dose_amount: (f.dose_amount as any) ?? null,
      dose_unit_code: (f.dose_unit_code as any) ?? '',
      output_quantity_per_batch: (f.output_quantity_per_batch as any) ?? null,
      price: (f.price as any) ?? null,
      notes: (f.notes as any) ?? '',
      active: (f.active as any) ? 1 : 0
    });
    this.itemsFA.clear();
    if (id) {
      this.api.getFormula(id).subscribe({
        next: (det) => {
          this.itemsFA.clear();
          const list = (det as any).items || [];
          list.forEach((it: any) => {
            const g = this.fb.group({
              tipo: [it.tipo, Validators.required],
              ativo_id: [it.ativo_id ?? null],
              insumo_nome: [it.insumo_nome ?? ''],
              quantity: [it.quantity ?? null, Validators.required],
              unit_code: [it.unit_code ?? '', Validators.required]
            });
            this.items.push(g);
          });
        },
        error: () => {}
      });
    }
    this.step.set(1);
  }

  saveFormula() {
    if (this.form.invalid) { this.error.set('Preencha os campos obrigatórios.'); return; }
    this.error.set(null); this.saving.set(true);
    const body: FormulaDto = {
      id: (this.form.value.id as any) ?? undefined,
      name: this.form.value.name!,
      form_id: Number(this.form.value.form_id!),
      output_unit_code: String(this.form.value.output_unit_code!),
      dose_amount: (this.form.value.dose_amount as any) ?? null,
      dose_unit_code: (this.form.value.dose_unit_code as any) || null,
      output_quantity_per_batch: (this.form.value.output_quantity_per_batch as any) ?? null,
      price: (this.form.value.price as any) ?? null,
      notes: (this.form.value.notes as any) || null,
      active: (this.form.value.active as any) ? 1 : 0
    };
    const id = this.form.value.id as any;
    const req$ = id ? this.api.updateFormula(id, body) : this.api.createFormula(body);
    req$.subscribe({
      next: (res) => { this.form.patchValue({ id: (res as any).id || id }); this.saving.set(false); /* permanece na etapa 1 com itens abaixo */ },
      error: () => { this.saving.set(false); this.error.set('Falha ao salvar fórmula'); }
    });
  }

  // itens da fórmula
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
  }
  removeItem(i: number) { this.items.removeAt(i); }

  saveItems() {
    const id = this.form.value.id;
    if (!id) { this.error.set('Salve a fórmula antes de adicionar itens.'); return; }
    const items: FormulaItemDto[] = this.items.controls.map((c: any) => {
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
    this.saving.set(true);
    this.api.updateFormulaItems(Number(id), items).subscribe({
      next: () => { this.saving.set(false); this.error.set(null); /* permanece na tela */ },
      error: () => { this.saving.set(false); this.error.set('Falha ao salvar itens'); }
    });
  }

  // Validação e salvamento unificado
  private validateItems(): { valid: boolean; message?: string } {
    const n = this.items.length;
    if (n === 0) return { valid: true };
    for (let i = 0; i < n; i++) {
      const v: any = (this.items.at(i) as any).value;
      if (!v || !v.tipo) return { valid: false, message: `Item ${i + 1}: selecione o tipo.` };
      if (!v.quantity || Number(v.quantity) <= 0) return { valid: false, message: `Item ${i + 1}: informe uma quantidade válida.` };
      if (!v.unit_code) return { valid: false, message: `Item ${i + 1}: selecione a unidade.` };
      if (v.tipo === 'ativo') {
        if (!v.ativo_id) return { valid: false, message: `Item ${i + 1}: selecione um ativo da lista.` };
      } else if (v.tipo === 'insumo') {
        if (!v.insumo_nome || String(v.insumo_nome).trim().length === 0) return { valid: false, message: `Item ${i + 1}: informe o nome do insumo.` };
      }
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

  saveAll() {
    // Se não houver itens, salva só a fórmula. Se houver itens, valida todos; se inválido, não salva nada.
    const hasItems = this.items.length > 0;
    if (hasItems) {
      const chk = this.validateItems();
      if (!chk.valid) { this.error.set(chk.message || 'Itens inválidos.'); return; }
    }

    if (this.form.invalid) { this.error.set('Preencha os campos obrigatórios da fórmula.'); return; }
    this.error.set(null); this.saving.set(true);

    const body: FormulaDto = {
      id: (this.form.value.id as any) ?? undefined,
      name: this.form.value.name!,
      form_id: Number(this.form.value.form_id!),
      output_unit_code: String(this.form.value.output_unit_code!),
      dose_amount: (this.form.value.dose_amount as any) ?? null,
      dose_unit_code: (this.form.value.dose_unit_code as any) || null,
      output_quantity_per_batch: (this.form.value.output_quantity_per_batch as any) ?? null,
      price: (this.form.value.price as any) ?? null,
      notes: (this.form.value.notes as any) || null,
      active: (this.form.value.active as any) ? 1 : 0
    };

    const idExisting = this.form.value.id as any;
    const items = hasItems ? this.buildItemsPayload() : [];
    const done = () => { this.saving.set(false); };

    const afterFormula = (id: number | string) => {
      if (!hasItems) { done(); return; }
      this.api.updateFormulaItems(id, items).subscribe({
        next: () => { done(); this.error.set(null); },
        error: () => { done(); this.error.set('Falha ao salvar itens'); }
      });
    };

    if (idExisting) {
      this.api.updateFormula(idExisting, body).subscribe({
        next: () => afterFormula(Number(idExisting)),
        error: () => { done(); this.error.set('Falha ao salvar fórmula'); }
      });
    } else {
      this.api.createFormula(body).subscribe({
        next: (res) => { const newId = (res as any).id; this.form.patchValue({ id: newId }); afterFormula(Number(newId)); },
        error: () => { done(); this.error.set('Falha ao criar fórmula'); }
      });
    }
  }
}
