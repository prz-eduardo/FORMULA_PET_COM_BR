import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminApiService, ProdutoDto, TaxonomyType, UnitDto, ProductFormDto, EstoqueAtivoDto, PromocaoDto, FormulaAvailabilityResponse } from '../../../../services/admin-api.service';

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
  step = signal(0); // 0..6
  steps = [
    { key: 'imagem', label: 'Imagem' },
    { key: 'formula', label: 'Fórmula' },
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

  // Ativo flow removido; agora deriva de fórmula quando aplicável
  produtosExistentes: Array<ProdutoDto> = [];
  // config (novas tabelas)
  units: UnitDto[] = [];
  forms: ProductFormDto[] = [];
  estoqueLotes: EstoqueAtivoDto[] = [];
  estoqueSelecionado: EstoqueAtivoDto | null = null;
  // promoções
  promocoes: PromocaoDto[] = [];
  showPromoModal = false;
  promocaoSelecionada: PromocaoDto | null = null;
  showPromoDetail = false;
  promoDetalhe: PromocaoDto | null = null;
  
  // fórmulas para produtos manipulados
  formulas: ProductFormDto[] = [];
  formulasSelect: Array<{ id: number; name: string }> = [];
  formulaQuery = signal('');
  formulasAll: Array<{ id: number; name: string; form_name?: string }> = [];
  formulasFiltered: Array<{ id: number; name: string; form_name?: string }> = [];
  formulaStatus: { missing: Array<{ ativo_id: number; ativo_nome?: string }>, items: Array<{ ativo_id: number; ativo_nome: string; required_per_unit: number; unit_code: string; available_converted: number; producible_units: number }>, lotsByAtivo: Record<string, EstoqueAtivoDto[]> } = { missing: [], items: [], lotsByAtivo: {} };

  ngOnInit() {
    this.form = this.fb.group({
      id: [null],
      // novo modelo
      tipo: ['pronto', Validators.required], // 'pronto' | 'manipulado'
      active: [1], // 1 ativo, 0 inativo
  formulaId: [null], // quando setado, força tipo = 'manipulado'
      name: ['', Validators.required],
      description: ['', Validators.required],
      price: [0, [Validators.required, Validators.min(0)]],
      image: [null],
      categoryId: [null, Validators.required],
      discount: [null],
      rating: [null],
      stock: [null],
      tags: this.fb.array<string>([]),
      weightValue: [0],
      weightUnit: ['g'],
      images: this.fb.array<string>([]), // base64 gallery
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

    // carregar config (formas/unidades/ativos consolidado) - ativos ficam apenas para derivação via fórmula
    this.api.getConfigNewProduct().subscribe({
      next: (res) => {
        this.forms = res.forms || [];
        this.units = res.units || [];
        // não exibimos mais busca direta de ativo
      },
      error: () => { this.forms = []; this.units = []; }
    });

    // carregar fórmulas para seleção quando tipo = manipulado
    this.api.listFormulas({ page: 1, pageSize: 100 }).subscribe({
      next: (res) => {
        const items = res?.data || [];
        this.formulasSelect = items.map(f => ({ id: f.id as number, name: f.name }));
        this.formulasAll = items.map(f => ({ id: f.id as number, name: f.name, form_name: (f as any).form_name }));
        this.applyFormulaFilter();
      },
      error: () => { this.formulasSelect = []; }
    });

    // editar produto se tiver id na rota
    const produtoId = this.route.snapshot.queryParamMap.get('produto_id');
    if (produtoId) this.loadProduto(produtoId);

    // ativo search removido
  }

  get tagsFA() { return this.form.get('tags') as FormArray; }
  get dosageFA() { return this.form.get(['customizations','dosage']) as FormArray; }
  get packagingFA() { return this.form.get(['customizations','packaging']) as FormArray; }
  get imagesFA() { return this.form.get('images') as FormArray; }

  // helpers for template display
  formulaNameById(id: number | null): string {
    if (!id) return '—';
    const f = this.formulasSelect.find(x => x.id === id);
    return f?.name || '—';
  }
  categoryNameById(id: number | string | null): string {
    if (id == null) return '—';
    const c = this.categoriasList.find(x => x.id === id);
    return c?.name || '—';
  }

  // footer next button label
  nextLabel(): string {
    // Step 1 (Fórmula): permitir pular se nenhuma fórmula selecionada
    if (this.step() === 1 && !this.form.value.formulaId) return 'Pular';
    return 'Avançar';
  }

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
          // mapeamento básico para compatibilidade de edição antiga
          name: p.name,
          description: p.description,
          price: p.price,
          image: p.image ?? null,
          // vamos tentar mapear nome -> id se existir na lista
          categoryId: this.categoriasList.find(c => c.name === (p as any).category)?.id ?? null,
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
        // Imagem obrigatória
        const img = this.form.get('image')?.value;
        return !!img;
      }
      case 1: {
        // Fórmula opcional; quando fórmula selecionada (manipulado), exigir lote (estoqueId)
        const formulaId = this.form.get('formulaId')?.value;
        if (!formulaId) return true;
        const estoqueId = this.form.get('estoqueId')?.value;
        return !!estoqueId;
      }
      case 2: {
        const name = this.form.get('name');
        const desc = this.form.get('description');
        const tipo = this.form.get('tipo');
        const isManipulado = tipo?.value === 'manipulado';
        const formulaOk = isManipulado ? !!this.form.get('formulaId')?.value : true;
        return !!name && !!desc && name.valid && desc.valid && !!tipo && tipo.valid && formulaOk;
      }
      case 3: {
        const price = this.form.get('price');
        return !!price && price.valid;
      }
      case 4: {
        const cat = this.form.get('categoryId');
        return !!cat && cat.valid;
      }
      default:
        return true;
    }
  }
  markStepTouched(i: number) {
    const mark = (path: string) => this.form.get(path)?.markAsTouched();
    switch (i) {
      case 0: mark('image'); break;
      case 1: mark('formulaId'); mark('estoqueId'); break;
      case 2: mark('name'); mark('description'); mark('tipo'); if (this.form.get('tipo')?.value === 'manipulado') mark('formulaId'); break;
      case 3: mark('price'); break;
      case 4: mark('categoryId'); break;
    }
  }

  onImageSelected(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => this.form.patchValue({ image: e.target.result });
    reader.readAsDataURL(file);
  }

  onImagesSelected(event: any) {
    const files: FileList | undefined = event.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e: any) => this.imagesFA.push(this.fb.control<string>(e.target.result));
      reader.readAsDataURL(file);
    });
    // reset input
    event.target.value = '';
  }
  removeImageAt(i: number) { if (i>=0) this.imagesFA.removeAt(i); }
  moveImage(i: number, dir: -1 | 1) {
    const target = i + dir;
    if (target < 0 || target >= this.imagesFA.length) return;
    const current = this.imagesFA.at(i).value;
    const other = this.imagesFA.at(target).value;
    this.imagesFA.at(i).setValue(other);
    this.imagesFA.at(target).setValue(current);
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

  // Fórmula: seleção e derivação de estoques a partir dos ativos da fórmula
  onFormulaChange(formulaId: number | null) {
    // Define tipo conforme presença de fórmula
    this.form.patchValue({ tipo: formulaId ? 'manipulado' : 'pronto' });
    this.estoqueSelecionado = null; this.form.patchValue({ estoqueId: null, ativoId: null });
    this.estoqueLotes = [];
    if (!formulaId) return;
    // Backend fornece lotes e faltas diretamente, dado formula_id
    this.api.getFormulaAvailability(formulaId).subscribe({
      next: (res: FormulaAvailabilityResponse) => {
        // Guardar itens e lots por ativo
        this.formulaStatus.items = res.items || [];
        this.formulaStatus.missing = res.missing || [];
        this.formulaStatus.lotsByAtivo = res.lots || {};
        // Flaten todos os lotes para a seleção simples
        const flat: EstoqueAtivoDto[] = [];
        Object.values(this.formulaStatus.lotsByAtivo).forEach(arr => flat.push(...(arr || [])));
        this.estoqueLotes = flat;
      },
      error: () => { this.estoqueLotes = []; this.formulaStatus.missing = []; this.formulaStatus.items = []; this.formulaStatus.lotsByAtivo = {}; }
    });
  }

  onFormulaQueryInput(q: string) {
    this.formulaQuery.set(q || '');
    this.applyFormulaFilter();
  }
  applyFormulaFilter() {
    const q = (this.formulaQuery() || '').toLowerCase();
    if (!q) {
      this.formulasFiltered = this.formulasAll.slice(0, 50);
      return;
    }
    this.formulasFiltered = this.formulasAll.filter(ff => ((ff.name + ' ' + (ff.form_name || '')).toLowerCase().includes(q))).slice(0, 50);
  }
  missingLabel(): string {
    const arr = this.formulaStatus?.missing || [];
    if (!arr.length) return '';
    return arr.map(m => m.ativo_nome || ('#' + m.ativo_id)).join(', ');
  }
  selecionarLote(lote: EstoqueAtivoDto) {
    this.estoqueSelecionado = lote;
    this.form.patchValue({ estoqueId: lote.id });
  }
  openPromoModal() {
    // Se já temos promoções carregadas (por ativo), apenas abre
    if (!this.promocoes || this.promocoes.length === 0) {
      // Carregar promoções ativas gerais
      this.api.listPromocoes({ active: 1, page: 1, pageSize: 50 }).subscribe({
        next: (res) => this.promocoes = res.data || [],
        error: () => this.promocoes = []
      });
    }
    this.showPromoModal = true;
  }

  openPromoDetail(promoId: number) {
    this.api.getPromocao(promoId).subscribe({
      next: (res) => { this.promoDetalhe = res; this.showPromoDetail = true; },
      error: () => { this.promoDetalhe = null; this.showPromoDetail = false; }
    });
  }
  // removido: carregamento de ativos públicos (agora vem via config-new-product)

  // categorias: criar/editar dentro da página
  createTaxonomia(tipo: TaxonomyType, name: string) {
    if (!name) return;
    this.api.createTaxonomia(tipo, name).subscribe({
      next: (res) => {
        this.loadTaxonomy(tipo);
        if (tipo === 'categorias') this.form.patchValue({ categoryId: res.id });
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

  resetForm() { this.form.reset({ tipo: 'pronto', active: 1, price: 0, weightValue: 0, weightUnit: 'g' }); this.tagsFA.clear(); this.dosageFA.clear(); this.packagingFA.clear(); this.imagesFA.clear(); this.estoqueSelecionado = null; }

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
    // map tags names -> ids
    const tagNameToId = new Map(this.tagsList.map(t => [t.name, t.id] as [string, number | string]));
    const tag_ids = (this.tagsFA.value as string[])
      .map(n => tagNameToId.get(n))
      .filter((v): v is number | string => v != null);
    const categoria_ids = this.form.value.categoryId ? [this.form.value.categoryId] : [];
    // imagens com posição: primeira do array é capa (posicao 0); se houver 'image' single, insere como capa antes da galeria
    const gallery: string[] = this.imagesFA.value as string[];
    const imagens: Array<{ data: string; posicao: number }> = [];
    const cover = this.form.value.image as string | null;
    let pos = 0;
    if (cover) { imagens.push({ data: cover, posicao: pos++ }); }
    gallery.forEach(img => imagens.push({ data: img, posicao: pos++ }));

    const tipo: 'pronto' | 'manipulado' = this.form.value.tipo;
    const body: any = {
      nome: this.form.value.name,
      descricao: this.form.value.description,
      preco: this.form.value.price,
      tipo,
      ativo: this.form.value.active ?? 1,
      categoria_ids,
      tag_ids,
      imagens,
    };
  if (tipo === 'manipulado') body.formula_id = this.form.value.formulaId;
    if (this.form.value.estoqueId) body.estoque_id = this.form.value.estoqueId;

    // Se for edição de produto legado, usamos update antigo; para novo, usar endpoint full
    const legacyId = this.form.value.id;
  const req$ = legacyId ? this.api.updateProduto(legacyId, {
      id: legacyId,
      name: this.form.value.name,
      description: this.form.value.description,
      price: this.form.value.price,
      image: this.form.value.image ?? null,
      category: (this.categoriasList.find(c => c.id === this.form.value.categoryId)?.name) || '',
      customizations: { dosage: this.dosageFA.value, packaging: this.packagingFA.value },
      tags: this.tagsFA.value,
      discount: this.form.value.discount ?? null,
      rating: this.form.value.rating ?? null,
      stock: this.form.value.stock ?? null,
      weightValue: this.form.value.weightValue ?? null,
      weightUnit: this.form.value.weightUnit ?? null,
      ativoId: this.form.value.ativoId ?? null,
      estoqueId: this.form.value.estoqueId ?? null,
    }) : this.api.createMarketplaceProdutoFull(body);
    req$.subscribe({
      next: (res) => {
        // Após criar, se houver promoção selecionada, vincular produto à promoção
        const newId = res?.id;
        const promoId = this.promocaoSelecionada?.id;
        if (!legacyId && newId && promoId) {
          this.api.setPromocaoProdutos(promoId, [Number(newId)]).subscribe({
            next: () => { this.saving.set(false); this.success.set('Produto salvo e campanha aplicada.'); this.form.patchValue({ id: newId }); },
            error: () => { this.saving.set(false); this.success.set('Produto salvo. Falha ao aplicar campanha.'); this.form.patchValue({ id: newId }); }
          });
          return;
        }
        this.saving.set(false); this.success.set('Produto salvo com sucesso.'); this.form.patchValue({ id: res.id });
      },
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
