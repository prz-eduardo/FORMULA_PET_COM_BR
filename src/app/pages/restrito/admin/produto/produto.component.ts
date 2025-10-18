import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminApiService, ProdutoDto, TaxonomyType, UnitDto, ProductFormDto, EstoqueAtivoDto } from '../../../../services/admin-api.service';

interface AtivoBasic { id: number | string; nome: string; descricao?: string }

@Component({
  selector: 'app-produto',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './produto.component.html',
  styleUrls: ['./produto.component.scss']
})
export class ProdutoComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(AdminApiService);
  private route = inject(ActivatedRoute);
  public router = inject(Router);

  form!: FormGroup;
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  // stepper state
  step = signal(0); // 0..5
  steps = [
    { key: 'ativo', label: 'Ativo' },
    { key: 'basico', label: 'Básico' },
    { key: 'preco', label: 'Preço/Estoque' },
    { key: 'categorias', label: 'Categoria/Tags' },
    { key: 'custom', label: 'Customizações' },
    { key: 'revisao', label: 'Revisão' }
  ];

  // taxonomias
  categoriasList: Array<{ id: string | number; name: string }> = [];
  tagsList: Array<{ id: string | number; name: string }> = [];
  embalagensList: Array<{ id: string | number; name: string }> = [];
  dosagesList: Array<{ id: string | number; name: string }> = [];

  // modais
  showDosageModal = false;
  showPackagingModal = false;
  showTagModal = false;
  showCategoryModal = false;

  // busca de ativo (opcional)
  // usamos o payload consolidado de config-new-product (id, nome)
  ativoQuery = signal('');
  ativosAll: AtivoBasic[] = [];
  ativosSugestoes: Array<{ id: number|string; ativo_nome: string }> = [];
  ativoSelecionado: { id: number|string; ativo_nome: string } | null = null;
  produtosExistentes: Array<ProdutoDto> = [];
  // config (novas tabelas)
  units: UnitDto[] = [];
  forms: ProductFormDto[] = [];
  estoqueLotes: EstoqueAtivoDto[] = [];
  estoqueSelecionado: EstoqueAtivoDto | null = null;

  ngOnInit() {
    this.form = this.fb.group({
      id: [null],
      name: ['', Validators.required],
      description: ['', Validators.required],
      price: [0, [Validators.required, Validators.min(0)]],
      image: [null],
      category: ['', Validators.required],
      discount: [null],
      rating: [null],
      stock: [null],
      tags: this.fb.array<string>([]),
      weightValue: [0],
      weightUnit: ['g'],
      customizations: this.fb.group({
        dosage: this.fb.array<string>([]),
        packaging: this.fb.array<string>([])
      }),
      ativoId: [null],
      estoqueId: [null]
    });

  // carregar taxonomias
    this.loadTaxonomy('categorias');
    this.loadTaxonomy('tags');
    this.loadTaxonomy('embalagens');
    this.loadTaxonomy('dosages');

    // carregar config (formas/unidades/ativos consolidado)
    this.api.getConfigNewProduct().subscribe({
      next: (res) => {
        this.forms = res.forms || [];
        this.units = res.units || [];
        // ativos básicos (id, nome) para busca local
        this.ativosAll = Array.isArray(res.ativos) ? res.ativos.map(a => ({ id: a.id, nome: a.nome })) : [];
      },
      error: () => { this.forms = []; this.units = []; this.ativosAll = []; }
    });

    // editar produto se tiver id na rota
    const produtoId = this.route.snapshot.queryParamMap.get('produto_id');
    if (produtoId) this.loadProduto(produtoId);

    this.setupAtivoSearch();
  }

  get tagsFA() { return this.form.get('tags') as FormArray; }
  get dosageFA() { return this.form.get(['customizations','dosage']) as FormArray; }
  get packagingFA() { return this.form.get(['customizations','packaging']) as FormArray; }

  private loadTaxonomy(tipo: TaxonomyType) {
    this.loading.set(true);
    this.api.listTaxonomia(tipo).subscribe({
      next: (res) => {
        if (tipo === 'categorias') this.categoriasList = res.data;
        else if (tipo === 'tags') this.tagsList = res.data;
        else if (tipo === 'embalagens') this.embalagensList = res.data;
        else if (tipo === 'dosages') this.dosagesList = res.data;
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  private loadProduto(id: string | number) {
    this.loading.set(true);
    this.api.getProduto(id).subscribe({
      next: (p) => {
        this.form.patchValue({
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          image: p.image ?? null,
          category: p.category,
          discount: p.discount ?? null,
          rating: p.rating ?? null,
          stock: p.stock ?? null,
          weightValue: p.weightValue ?? 0,
          weightUnit: p.weightUnit ?? 'g',
        });
  this.tagsFA.clear(); (p.tags || []).forEach(t => this.tagsFA.push(this.fb.control<string>(t)));
  this.dosageFA.clear(); (p.customizations?.dosage || []).forEach(d => this.dosageFA.push(this.fb.control<string>(d)));
  this.packagingFA.clear(); (p.customizations?.packaging || []).forEach(e => this.packagingFA.push(this.fb.control<string>(e)));
        this.loading.set(false);
      },
      error: (err) => { console.error(err); this.loading.set(false); }
    });
  }

  // stepper helpers
  goToStep(i: number) {
    if (i < 0 || i >= this.steps.length) return;
    // only allow jumping forward if previous steps are valid
    for (let s = 0; s < i; s++) {
      if (!this.isStepValid(s)) { this.markStepTouched(s); return; }
    }
    this.step.set(i);
  }
  nextStep() {
    const i = this.step();
    if (!this.isStepValid(i)) { this.markStepTouched(i); return; }
    if (i < this.steps.length - 1) this.step.set(i + 1);
  }
  prevStep() {
    const i = this.step();
    if (i > 0) this.step.set(i - 1);
  }
  isStepValid(i: number): boolean {
    switch (i) {
      case 0: {
        // Ativo é opcional, porém, se houver ativo selecionado, exigir estoqueId
        const ativoId = this.form.get('ativoId')?.value;
        if (!ativoId) return true;
        const estoqueId = this.form.get('estoqueId')?.value;
        return !!estoqueId;
      }
      case 1: {
        const name = this.form.get('name');
        const desc = this.form.get('description');
        return !!name && !!desc && name.valid && desc.valid;
      }
      case 2: {
        const price = this.form.get('price');
        return !!price && price.valid;
      }
      case 3: {
        const cat = this.form.get('category');
        return !!cat && cat.valid;
      }
      default:
        return true;
    }
  }
  markStepTouched(i: number) {
    const mark = (path: string) => this.form.get(path)?.markAsTouched();
    switch (i) {
      case 0: mark('ativoId'); break;
      case 1: mark('name'); mark('description'); break;
      case 2: mark('price'); break;
      case 3: mark('category'); break;
    }
  }

  onImageSelected(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => this.form.patchValue({ image: e.target.result });
    reader.readAsDataURL(file);
  }

  // tags/dosagens/embalagens
  addTag(tag: string) { if (!tag) return; this.tagsFA.push(this.fb.control<string>(tag)); }
  removeTagAt(i: number) { this.tagsFA.removeAt(i); }
  addDosage(val: string) { if (!val) return; this.dosageFA.push(this.fb.control<string>(val)); this.showDosageModal = false; }
  removeDosageAt(i: number) { this.dosageFA.removeAt(i); }
  addPackaging(val: string) { if (!val) return; this.packagingFA.push(this.fb.control<string>(val)); this.showPackagingModal = false; }
  removePackagingAt(i: number) { this.packagingFA.removeAt(i); }

  // toggles for selection chips
  toggleTagVal(name: string) {
    const idx = (this.tagsFA.value as any[]).findIndex((v: any) => v === name);
    if (idx > -1) this.removeTagAt(idx); else this.addTag(name);
  }
  toggleDosageVal(name: string) {
    const idx = (this.dosageFA.value as any[]).findIndex((v: any) => v === name);
    if (idx > -1) this.removeDosageAt(idx); else this.addDosage(name);
  }
  togglePackagingVal(name: string) {
    const idx = (this.packagingFA.value as any[]).findIndex((v: any) => v === name);
    if (idx > -1) this.removePackagingAt(idx); else this.addPackaging(name);
  }

  editarProdutoExistente(p: ProdutoDto) {
    this.router.navigate(['/restrito/produto'], { queryParams: { produto_id: p.id } });
  }

  // helpers para template
  hasTag(name: string) { return this.tagsFA.controls.some(c => c.value === name); }
  hasDosage(name: string) { return this.dosageFA.controls.some(c => c.value === name); }
  hasPackaging(name: string) { return this.packagingFA.controls.some(c => c.value === name); }

  reativarProdutoExistente(p: ProdutoDto) {
    // Placeholder: depende do backend ter campo status/active; por ora, navegar para edição
    this.editarProdutoExistente(p);
  }

  // ativo: busca e associação
  private setupAtivoSearch() {
    // Mantemos a busca manual via onAtivoQueryChange (com signal)
  }
  onAtivoQueryChange(q: string) {
    this.ativoQuery.set(q);
    const term = (q || '').trim();
    if (!term) { this.ativosSugestoes = []; return; }
    const lower = term.toLowerCase();
    this.ativosSugestoes = (this.ativosAll || [])
      .filter(a => (a.nome || '').toLowerCase().includes(lower) || ((a as any).descricao || '').toLowerCase().includes(lower))
      .slice(0, 20)
      .map(a => ({ id: a.id as any, ativo_nome: (a as any).nome }));
  }
  selecionarAtivo(op: { id: number|string; ativo_nome: string }) {
    this.ativoSelecionado = op;
    this.form.patchValue({ ativoId: op.id });
    this.estoqueSelecionado = null;
    this.form.patchValue({ estoqueId: null });
    // buscar produtos existentes por ativo
    this.api.produtosPorAtivo(op.id).subscribe({
      next: (res) => this.produtosExistentes = res || [],
      error: () => this.produtosExistentes = []
    });
    // carregar lotes de estoque para o ativo selecionado
    this.api.listEstoque({ ativo_id: op.id, page: 1, pageSize: 100, active: 1 }).subscribe({
      next: (res) => this.estoqueLotes = res.data || [],
      error: () => this.estoqueLotes = []
    });
  }
  selecionarLote(lote: EstoqueAtivoDto) {
    this.estoqueSelecionado = lote;
    this.form.patchValue({ estoqueId: lote.id });
  }
  // removido: carregamento de ativos públicos (agora vem via config-new-product)

  // categorias: criar/editar dentro da página
  createTaxonomia(tipo: TaxonomyType, name: string) {
    if (!name) return;
    this.api.createTaxonomia(tipo, name).subscribe({
      next: (res) => {
        this.loadTaxonomy(tipo);
        if (tipo === 'categorias') this.form.patchValue({ category: res.name });
      }
    });
  }
  updateTaxonomia(tipo: TaxonomyType, item: { id: number|string; name: string }, newName: string) {
    if (!newName) return;
    this.api.updateTaxonomia(tipo, item.id, newName).subscribe(() => this.loadTaxonomy(tipo));
  }
  deleteTaxonomia(tipo: TaxonomyType, item: { id: number|string; name: string }) {
    this.api.deleteTaxonomia(tipo, item.id).subscribe(() => this.loadTaxonomy(tipo));
  }

  resetForm() { this.form.reset({ price: 0, weightValue: 0, weightUnit: 'g' }); this.tagsFA.clear(); this.dosageFA.clear(); this.packagingFA.clear(); }

  fixRating(event: any) {
    const v = parseFloat(event.target.value);
    const bounded = isNaN(v) ? null : Math.max(0, Math.min(5, v));
    this.form.patchValue({ rating: bounded });
  }

  submit() {
    // require all required steps valid before submit
    for (let s = 0; s <= 3; s++) {
      if (!this.isStepValid(s)) { this.markStepTouched(s); this.error.set('Preencha os campos obrigatórios.'); return; }
    }
    this.error.set(null); this.saving.set(true);
    const payload: ProdutoDto = {
      id: this.form.value.id ?? undefined,
      name: this.form.value.name,
      description: this.form.value.description,
      price: this.form.value.price,
      image: this.form.value.image ?? null,
      category: this.form.value.category,
      customizations: {
        dosage: this.dosageFA.value,
        packaging: this.packagingFA.value
      },
      discount: this.form.value.discount ?? null,
      rating: this.form.value.rating ?? null,
      stock: this.form.value.stock ?? null,
      tags: this.tagsFA.value,
      weightValue: this.form.value.weightValue ?? null,
      weightUnit: this.form.value.weightUnit ?? null,
      ativoId: this.form.value.ativoId ?? null,
      estoqueId: this.form.value.estoqueId ?? null,
    };
    const req$ = payload.id ? this.api.updateProduto(payload.id, payload) : this.api.createProduto(payload);
    req$.subscribe({
      next: (res) => { this.saving.set(false); this.success.set('Produto salvo com sucesso.'); this.form.patchValue({ id: res.id }); },
      error: (err) => {
        console.error(err);
        this.saving.set(false);
        // Se backend retornar 409 por existir produto com mesmo ativo, oferecemos reativar/editar
        if (err?.status === 409 && this.produtosExistentes.length) {
          const alvo = this.produtosExistentes[0]; // mais recente esperado primeiro pela API
          const wantReactivate = confirm('Já existe produto para este ativo. Deseja reativar o mais recente?');
          if (wantReactivate && alvo?.id != null) {
            this.saving.set(true);
            this.api.reativarProduto(alvo.id).subscribe({
              next: (r) => { this.saving.set(false); this.success.set('Produto reativado com sucesso.'); this.form.patchValue({ id: r.id }); },
              error: (e2) => { console.error(e2); this.saving.set(false); this.error.set('Falha ao reativar. Você pode editar o existente.'); }
            });
            return;
          } else {
            // Se não reativar, abre edição do encontrado
            if (alvo?.id != null) this.editarProdutoExistente(alvo);
            return;
          }
        }
        this.error.set('Erro ao salvar produto.');
      }
    });
  }

}
