import { Component, OnInit, inject, signal, NgZone, ChangeDetectorRef, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ButtonDirective, ButtonComponent } from '../../../../shared/button';
import { AdminApiService, ProdutoDto, TaxonomyType, UnitDto, ProductFormDto, EstoqueAtivoDto, PromocaoDto, FormulaAvailabilityResponse } from '../../../../services/admin-api.service';
import { EMBALAGENS } from '../../../../constants/embalagens';
import { ProductCardV2Component } from '../../../../product-card-v2/product-card-v2.component';
import { ShopProduct } from '../../../../services/store.service';
import { DEFAULT_PRODUCT_CARD_WIDTH } from '../../../../constants/card.constants';

interface AtivoBasic { id: number | string; nome: string; descricao?: string }

@Component({
  selector: 'app-produto',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonDirective, ButtonComponent, ProductCardV2Component],
  templateUrl: './produto.component.html',
  styleUrls: ['./produto.component.scss']
})
export class ProdutoComponent implements OnInit {
  @Input() editItem: ProdutoDto | null = null;
  @Input() embedded = false;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<any>();
  private _pendingEditItem: any | null = null;
      public readonly defaultCardWidth = DEFAULT_PRODUCT_CARD_WIDTH;
    destaqueHome = false;
    imagemPrincipal: string | null = null;
    public hoveredImg: number | null = null;
    public isDragOver = false;
      showCategoryDropdown = false;
    toggleCategoryDropdown() {
      this.showCategoryDropdown = !this.showCategoryDropdown;
    }

    selectCategory(id: string | number, event: Event) {
      event.stopPropagation();
      this.form.patchValue({ categoryId: id });
      this.showCategoryDropdown = false;
    }
  private fb = inject(FormBuilder);
  private api = inject(AdminApiService);
  private route = inject(ActivatedRoute);
  public router = inject(Router);
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  form!: FormGroup;
  private imagesSub: Subscription | null = null;
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  // image upload constraints and feedback
  MAX_IMAGES = 3;
  MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
  ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  imageMessage = signal<string | null>(null);

  // stepper state
  step = signal(0); // 0..3
  steps = [
    { key: 'imagem', label: 'Imagens' },
    { key: 'detalhes', label: 'Detalhes' },
    { key: 'comercial', label: 'Comercial' },
    { key: 'revisao', label: 'Revisão' }
  ];

  // taxonomias (agora vindas de customizacoes)
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
  // overlay refs for promo modal
  private promoOverlay: HTMLDivElement | null = null;
  private promoListContainer: HTMLDivElement | null = null;
  private loadingPromos = false;
  private _docDragOverHandler: any = null;
  private _docDropHandler: any = null;
  
  // fórmulas para produtos manipulados
  formulas: ProductFormDto[] = [];
  formulasSelect: Array<{ id: number; name: string }> = [];
  formulaQuery = signal('');
  formulasAll: Array<{ id: number; name: string; form_name?: string }> = [];
  formulasFiltered: Array<{ id: number; name: string; form_name?: string }> = [];
  formulaStatus: { missing: Array<{ ativo_id: number; ativo_nome?: string }>, items: Array<{ ativo_id: number; ativo_nome: string; required_per_unit: number; unit_code: string; available_converted: number; producible_units: number }>, lotsByAtivo: Record<string, EstoqueAtivoDto[]> } = { missing: [], items: [], lotsByAtivo: {} };
  // índice selecionado nas sugestões (-1 = 'Produto pronto')
  selectedFormulaIndex = -1;

  // Autocomplete state for taxonomias (category, tags, packaging)
  categoryQuery = signal('');
  categoriesFiltered: Array<{ id: string | number; name: string }> = [];
  selectedCategoryIndex: number = -1;

  tagQuery = signal('');
  tagsFiltered: Array<{ id: string | number; name: string }> = [];
  selectedTagIndex: number = -1;

  packagingQuery = signal('');
  packagingFiltered: Array<{ id: string | number; name: string }> = [];
  selectedPackagingIndex: number = -1;
  formulaEnabled = false;

  ngOnInit() {
      // Inicializa destaqueHome e imagemPrincipal
      this.destaqueHome = false;
      this.imagemPrincipal = null;
      this.form = this.fb.group({
      id: [null],
      manipulado: [false], // novo toggle
      active: [1],
      formulaId: [null],
      name: ['', Validators.required],
      description: ['', Validators.required],
      price: [0, [Validators.required, Validators.min(0)]],
      image: [null],
      categoryId: [null, Validators.required],
      discount: [null],
      rating: [null],
      stock: [null],
      tags: this.fb.array<string>([]),
      weightValue: [null],
      weightUnit: ['g'],
      images: this.fb.array<string>([]),
      customizations: this.fb.group({
        dosage: this.fb.array<string>([]),
        packaging: this.fb.array<string>([])
      }),
      ativoId: [null],
      estoqueId: [null]
    });

    // initialize formula toggle based on any pre-filled form value
    this.formulaEnabled = !!(this.form?.value?.formulaId);
    // sincroniza máscara/ dígitos do preço com o formulário (para edição)
    this.syncPrecoDigitsFromForm();

    // manter a imagem principal atualizada: selecionar automaticamente a primeira imagem quando houver
    this.imagesSub = this.imagesFA.valueChanges.subscribe((vals: string[]) => {
      if (Array.isArray(vals) && vals.length > 0) {
        if (!this.imagemPrincipal || !vals.includes(this.imagemPrincipal)) this.imagemPrincipal = vals[0];
      } else {
        this.imagemPrincipal = null;
      }
    });

    // Carregar categorias, tags, dosagens e embalagens de customizacoes
    this.api.getMarketplaceCustomizacoes().subscribe({
      next: (res: any) => {
        // categorias/tags
        this.categoriasList = (res.categorias || []).map((c: any) => ({ id: c.id, name: c.nome || c.name }));
        this.tagsList = (res.tags || []).map((t: any) => ({ id: t.id, name: t.nome || t.name }));
        // dosagens/embalagens
        this.dosagesList = (res.dosages || []).map((d: any) => ({ id: d.id, name: d.nome || d.name }));
        const rspEmb = (res.embalagens || []).map((e: any, idx: number) => ({ id: e.id ?? idx + 1, name: e.nome || e.name || e }));
        if (rspEmb && rspEmb.length > 0) {
          this.embalagensList = rspEmb;
        } else {
          this.embalagensList = EMBALAGENS.map((name, idx) => ({ id: idx + 1, name }));
        }
      },
      error: () => {
        this.categoriasList = [];
        this.tagsList = [];
        this.dosagesList = [];
        this.embalagensList = EMBALAGENS.map((name, idx) => ({ id: idx + 1, name }));
      }
    });

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

    // editar produto se tiver id na rota (aplicar somente quando não estamos em modo embedded)
    const produtoId = this.route.snapshot.queryParamMap.get('produto_id');
    if (!this.editItem && produtoId) this.loadProduto(produtoId);
    // se editItem foi fornecido via @Input, aplica-o
    if (this.editItem) this.applyEditItem(this.editItem);
    if (this._pendingEditItem) { this.applyEditItem(this._pendingEditItem); this._pendingEditItem = null; }

    // ativo search removido
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editItem']) {
      const val = changes['editItem'].currentValue;
      if (!val) {
        // se entramos em modo embedded com null -> reset form
        if (this.form) this.resetForm();
        return;
      }
      if (this.form) this.applyEditItem(val);
      else this._pendingEditItem = val;
    }
  }

  private applyEditItem(p: any) {
    try {
      const catId = (p as any).categoryId ?? this.categoriasList.find(c => c.name === (p as any).category)?.id ?? null;
      this.form.patchValue({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        image: p.image ?? null,
        categoryId: catId,
        discount: p.discount ?? null,
        rating: p.rating ?? null,
        stock: p.stock ?? null,
        weightValue: p.weightValue ?? null,
        weightUnit: p.weightUnit ?? 'g',
        formulaId: (p as any).formId ?? null,
        manipulado: !!((p as any).formId || (p as any).tipo === 'manipulado')
      });

      this.tagsFA.clear(); (p.tags || []).forEach((t: any) => this.tagsFA.push(this.fb.control<string>(t)));
      this.dosageFA.clear(); (p.customizations?.dosage || []).forEach((d: any) => this.dosageFA.push(this.fb.control<string>(d)));
      this.packagingFA.clear(); (p.customizations?.packaging || []).forEach((e: any) => this.packagingFA.push(this.fb.control<string>(e)));

      this.imagesFA.clear();
      const imgs = (p as any).images ?? [];
      imgs.forEach((u: string) => this.imagesFA.push(this.fb.control<string>(u)));
      this.imagemPrincipal = p.image ?? (imgs.length ? imgs[0] : null);
      try { this.syncPrecoDigitsFromForm(); } catch(e) {}
    } catch (e) { console.error('applyEditItem error', e); }
  }

  private precoDigits = '';

    onPrecoKeydown(event: KeyboardEvent) {
      event.preventDefault();
      const key = event.key;
      // Permitir apenas números, backspace e delete
      if (/^\d$/.test(key)) {
        if (this.precoDigits.length < 9) this.precoDigits += key;
      } else if (key === 'Backspace') {
        this.precoDigits = this.precoDigits.slice(0, -1);
      } else if (key === 'Delete') {
        this.precoDigits = '';
      } else if (key === 'Tab' || key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown') {
        // permitir navegação
        return;
      } else {
        return;
      }
      // Atualiza valor
      let val = this.precoDigits || '0';
      const num = parseInt(val, 10);
      const reais = Math.floor(num / 100);
      const centavos = num % 100;
      this.form.patchValue({ price: num / 100 });
      this.priceMasked = {
        int: reais.toLocaleString('pt-BR'),
        dec: centavos.toString().padStart(2, '0')
      };
    }

    // Inicializa precoDigits e atualiza máscara ao abrir tela ou ao editar produto
    private syncPrecoDigitsFromForm() {
      const price = this.form?.value?.price;
      if (typeof price === 'number' && !isNaN(price)) {
        const num = Math.round(price * 100);
        this.precoDigits = num.toString();
        const reais = Math.floor(num / 100);
        const centavos = num % 100;
        this.priceMasked = {
          int: reais.toLocaleString('pt-BR'),
          dec: centavos.toString().padStart(2, '0')
        };
      } else {
        this.precoDigits = '';
        this.priceMasked = null;
      }
    }
  // Controle de edição do campo de preço
 


  editingPreco = false;


  enablePrecoEdit() {
    if (!this.editingPreco) {
      this.editingPreco = true;
      // Remove foco do input antigo, se houver
      setTimeout(() => {
        const wrapper = document.querySelector('.preco-input-wrapper') as HTMLElement;
        if (wrapper) wrapper.focus();
      }, 10);
    }
  }


  disablePrecoEdit() {
    this.editingPreco = false;
  }

    // Máscara de preço para exibição destacada
  priceMasked: { int: string, dec: string } | null = null;

  onPriceInput(event: any) {
    let val = event.target.value.replace(/\D/g, ''); // só números
    if (!val) val = '0';
    // Limite de 9 dígitos
    if (val.length > 9) val = val.slice(0, 9);
    // Formatar para centavos
    const num = parseInt(val, 10);
    const reais = Math.floor(num / 100);
    const centavos = num % 100;
    // Atualiza o campo do formulário
    this.form.patchValue({ price: num / 100 });
    // Atualiza a máscara para exibição
    this.priceMasked = {
      int: reais.toLocaleString('pt-BR'),
      dec: centavos.toString().padStart(2, '0')
    };
    // Atualiza o valor do input para manter só números
    event.target.value = val;
  }

  ngAfterViewInit() {
    // Inicializa a máscara se já houver valor
    const price = this.form?.value?.price;
    if (typeof price === 'number' && !isNaN(price)) {
      const num = Math.round(price * 100);
      const reais = Math.floor(num / 100);
      const centavos = num % 100;
      this.priceMasked = {
        int: reais.toLocaleString('pt-BR'),
        dec: centavos.toString().padStart(2, '0')
      };
    }
    // Listener para fechar dropdown de categoria ao clicar fora
    document.addEventListener('click', this.handleClickOutsideDropdown.bind(this));
    // Evitar que o navegador abra arquivos ao soltar fora da dropzone
    this._docDragOverHandler = (ev: any) => { try { ev.preventDefault(); } catch(e) {} };
    this._docDropHandler = (ev: any) => { try { ev.preventDefault(); } catch(e) {} };
    document.addEventListener('dragover', this._docDragOverHandler);
    document.addEventListener('drop', this._docDropHandler);
  }

  get tagsFA() { return this.form.get('tags') as FormArray; }
  get dosageFA() { return this.form.get(['customizations','dosage']) as FormArray; }
  get packagingFA() { return this.form.get(['customizations','packaging']) as FormArray; }
  get imagesFA() { return this.form.get('images') as FormArray; }

  get previewProduct(): ShopProduct {
    const fv = this.form?.value || {};
    const price = Number(fv.price) || 0;
    const promo = this.discountedPriceValue();
    const img = this.imagemPrincipal || (this.imagesFA?.controls?.length ? this.imagesFA.controls[0].value : '/imagens/placeholder.png');
    const discount = (fv.discount && Number(fv.discount) > 0) ? Number(fv.discount) : (promo != null && price > 0 ? Math.round((1 - (promo / price)) * 100) : 0);
    return {
      id: Number(fv.id) || 0,
      name: fv.name || 'Nome do produto',
      description: fv.description || '',
      price: price,
      image: img,
      imageUrl: img,
      category: this.categoryNameById(fv.categoryId) || '',
      tipo: fv.manipulado ? 'manipulado' : 'pronto',
      discount: discount as any,
      rating: fv.rating ?? undefined,
      ratingsCount: undefined,
      stock: fv.stock ?? undefined,
      tags: fv.tags || [],
      weight: fv.weightValue ? `${fv.weightValue}${fv.weightUnit || 'g'}` : undefined,
      promoPrice: promo ?? null,
      inStock: fv.stock ?? null,
      images: (this.imagesFA?.controls || []).map((c: any, i: number) => ({ id: i + 1, url: c.value })),
    } as ShopProduct;
  }

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

  // Promo helpers
  promoLabel(): string {
    const p: any = this.promocaoSelecionada as any;
    if (!p) return '—';
    if (p.ui && p.ui.valor_label) return p.ui.valor_label;
    if (p.tipo === 'percentual') return `${p.valor}%`;
    if (p.tipo === 'valor') return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(p.valor) || 0);
    return '—';
  }

  promoStatusLabel(status?: string | null): string {
    if (!status) return '—';
    switch (status) {
      case 'active': return 'Ativa';
      case 'upcoming': return 'Agendada';
      case 'expired': return 'Expirada';
      case 'inactive': return 'Inativa';
      default: return status;
    }
  }

  discountedPriceValue(): number | null {
    const price = Number(this.form?.value?.price);
    if (isNaN(price)) return null;
    const p: any = this.promocaoSelecionada as any;
    if (p) {
      const valor = Number(p.valor);
      if (isNaN(valor)) return null;
      if (p.tipo === 'percentual') return Math.max(0, +((price * (1 - valor / 100))).toFixed(2));
      if (p.tipo === 'valor') return Math.max(0, +((price - valor)).toFixed(2));
      return null;
    }
    // fallback: form-level discount (coupon stored in form.discount)
    const d = this.form?.value?.discount;
    if (d == null || d === '') return null;
    const disc = Number(d);
    if (isNaN(disc)) return null;
    if (disc > 0 && disc <= 100) {
      return Math.max(0, +((price * (1 - disc / 100))).toFixed(2));
    } else {
      return Math.max(0, +((price - disc)).toFixed(2));
    }
  }

  // limpa o valor 0 quando o usuário foca o campo (UX)
  clearWeightIfZero() {
    const v = this.form.get('weightValue')?.value;
    if (v === 0 || v === '0') this.form.patchValue({ weightValue: null });
  }

  setWeightUnit(unit: string) {
    if (!this.form) return;
    this.form.get('weightUnit')?.setValue(unit);
  }

  // normaliza o valor de weightValue para número ou null (não retornar 0)
  private parseWeightValue(v: any): number | null {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (!trimmed) return null;
      const num = Number(trimmed.replace(',', '.'));
      if (isNaN(num)) return null;
      return num === 0 ? null : num;
    }
    if (typeof v === 'number') return v === 0 ? null : v;
    return null;
  }

  // footer next button label
  nextLabel(): string {
    // Step 1 (Fórmula): permitir pular se nenhuma fórmula selecionada
    if (this.step() === 1 && !this.form.get('formulaId')?.value) return 'Pular';
    return 'Avançar';
  }

  // Removido: loadTaxonomy. Agora tudo vem de getMarketplaceCustomizacoes().

  private loadProduto(id: string | number) {
    this.loading.set(true);
    this.api.getProduto(id).subscribe({
      next: (p) => {
        // categoriaId: preferir id retornado pelo backend quando disponível, senão tentar mapear por nome
        const catId = (p as any).categoryId ?? this.categoriasList.find(c => c.name === (p as any).category)?.id ?? null;
        this.form.patchValue({
          id: p.id,
          // mapeamento básico para compatibilidade de edição antiga
          name: p.name,
          description: p.description,
          price: p.price,
          image: p.image ?? null,
          categoryId: catId,
          discount: p.discount ?? null,
          rating: p.rating ?? null,
          stock: p.stock ?? null,
          weightValue: p.weightValue ?? null,
          weightUnit: p.weightUnit ?? 'g',
          formulaId: (p as any).formId ?? null,
          manipulado: !!((p as any).formId || (p as any).tipo === 'manipulado')
        });

        // tags, dosages, packaging
        this.tagsFA.clear(); (p.tags || []).forEach((t: any) => this.tagsFA.push(this.fb.control<string>(t)));
        this.dosageFA.clear(); (p.customizations?.dosage || []).forEach((d: any) => this.dosageFA.push(this.fb.control<string>(d)));
        this.packagingFA.clear(); (p.customizations?.packaging || []).forEach((e: any) => this.packagingFA.push(this.fb.control<string>(e)));

        // imagens: popular FormArray e imagem principal
        try {
          this.imagesFA.clear();
          const imgs = (p as any).images ?? [];
          imgs.forEach((u: string) => this.imagesFA.push(this.fb.control<string>(u)));
          // preferir imagem_principal / image
          this.imagemPrincipal = p.image ?? (imgs.length ? imgs[0] : null);
        } catch(e) { console.error('Erro ao popular imagens do produto', e); }

        // garantir que máscara/dígitos do preço reflitam o valor carregado
        try { this.syncPrecoDigitsFromForm(); } catch(e) { /* noop */ }

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
    this.closeAllModals();
    this.step.set(i);
  }
  nextStep() {
    const i = this.step();
    if (!this.isStepValid(i)) { this.markStepTouched(i); return; }
    if (i < this.steps.length - 1) {
      this.closeAllModals();
      this.step.set(i + 1);
    }
  }
  prevStep() {
    const i = this.step();
    if (i > 0) {
      this.closeAllModals();
      this.step.set(i - 1);
    }
  }
  isStepValid(i: number): boolean {
    switch (i) {
      case 0: {
        const imgs = this.form.get('images') as FormArray;
        return !!imgs && imgs.length > 0;
      }
      case 1: {
        // Detalhes + Fórmula: nome/descrição obrigatórios, fórmula opcional
        const name = this.form.get('name');
        const desc = this.form.get('description');
        return !!name && !!desc && name.valid && desc.valid;
      }
      case 2: {
        // Comercial: preço e categoria obrigatórios
        const price = this.form.get('price');
        const cat = this.form.get('categoryId');
        return !!price && price.valid && !!cat && cat.valid;
      }
      default:
        return true;
    }
  }
  markStepTouched(i: number) {
    const mark = (path: string) => this.form.get(path)?.markAsTouched();
    switch (i) {
      case 0: mark('image'); break;
      case 1: mark('formulaId'); mark('name'); mark('description'); break;
      case 2: mark('price'); mark('categoryId'); break;
    }
  }

  // Utility: close any open modals/overlays created by this component
  private closeAllModals() {
    // hide template-driven modals
    this.showTagModal = false;
    this.showCategoryModal = false;
    this.showPackagingModal = false;
    this.showDosageModal = false;
    this.showPromoModal = false;
    this.showPromoDetail = false;

    // clear suggestion lists (close autocompletes)
    this.tagsFiltered = [];
    this.categoriesFiltered = [];
    this.packagingFiltered = [];

    // remove any dynamic overlays appended to body
    try {
      if (this.promoOverlay) { this.promoOverlay.remove(); this.promoOverlay = null; this.promoListContainer = null; }
    } catch (e) { /* noop */ }
  }


  // Mantém compatibilidade, mas não usada mais
  onImageSelected(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;
    const { MAX_FILE_SIZE, ALLOWED_IMAGE_TYPES } = this;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      this.imageMessage.set('Formato inválido. Use JPG, PNG ou WEBP.');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      this.imageMessage.set('Arquivo maior que 3MB.');
      event.target.value = '';
      return;
    }
    const remaining = this.MAX_IMAGES - this.imagesFA.length;
    if (remaining <= 0) {
      this.imageMessage.set('Limite de 3 imagens atingido.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.imagesFA.push(this.fb.control<string>(e.target.result));
      this.imageMessage.set(null);
      try { this.cdr.detectChanges(); } catch(e) { /* noop */ }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  onImagesSelected(event: any) {
    const files: FileList | undefined = event.target.files;
    if (!files || files.length === 0) return;
    const beforeLen = this.imagesFA.length;
    const maxToAdd = this.MAX_IMAGES - beforeLen;
    if (maxToAdd <= 0) {
      this.imageMessage.set('Limite de 3 imagens atingido.');
      event.target.value = '';
      return;
    }
    const arr = Array.from(files);
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const f of arr) {
      if (accepted.length >= maxToAdd) break;
      if (!this.ALLOWED_IMAGE_TYPES.includes(f.type)) { rejected.push(`${f.name}: formato inválido`); continue; }
      if (f.size > this.MAX_FILE_SIZE) { rejected.push(`${f.name}: maior que 3MB`); continue; }
      accepted.push(f);
    }
    accepted.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e: any) => this.imagesFA.push(this.fb.control<string>(e.target.result));
      reader.readAsDataURL(file);
    });
    const msgs: string[] = [];
    if (accepted.length > 0) msgs.push(`${accepted.length} imagem(ns) adicionada(s).`);
    if (rejected.length > 0) msgs.push(`Arquivos rejeitados: ${rejected.join(', ')}`);
    if (beforeLen + accepted.length >= this.MAX_IMAGES) msgs.push('Limite de 3 imagens atingido.');
    this.imageMessage.set(msgs.length ? msgs.join(' ') : null);
    event.target.value = '';
  }
  onDragEnter(e: DragEvent) {
    e.preventDefault(); e.stopPropagation(); this.isDragOver = true;
  }
  onDragOver(e: DragEvent) { e.preventDefault(); e.stopPropagation(); }
  onDragLeave(e: DragEvent) { e.preventDefault(); e.stopPropagation(); this.isDragOver = false; }
  onDrop(e: DragEvent) {
    e.preventDefault(); e.stopPropagation(); this.isDragOver = false;
    const files = e.dataTransfer?.files;
    if (files && files.length) {
      // reuse existing file handler
      this.onImagesSelected({ target: { files } } as any);
    }
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

  // removed inline '+' handlers that opened taxonomy modals

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

  // Autocomplete helpers for Categoria
  onCategoryQueryInput(q: string) {
    this.categoryQuery.set(q || '');
    this.applyCategoryFilter();
  }
  applyCategoryFilter() {
    const q = (this.categoryQuery() || '').toLowerCase();
    if (!q) {
      this.categoriesFiltered = this.categoriasList.slice(0, 50);
      this.selectedCategoryIndex = this.categoriesFiltered.length ? 0 : -1;
      return;
    }
    this.categoriesFiltered = this.categoriasList.filter(c => (c.name || '').toLowerCase().includes(q)).slice(0, 50);
    this.selectedCategoryIndex = this.categoriesFiltered.length ? 0 : -1;
  }
  onCategoryKeydown(event: KeyboardEvent) {
    const len = (this.categoriesFiltered?.length || 0);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (len === 0) { this.selectedCategoryIndex = -1; }
      else { this.selectedCategoryIndex = this.selectedCategoryIndex < len - 1 ? this.selectedCategoryIndex + 1 : -1; }
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (len === 0) { this.selectedCategoryIndex = -1; }
      else { this.selectedCategoryIndex = this.selectedCategoryIndex === -1 ? len - 1 : (this.selectedCategoryIndex > 0 ? this.selectedCategoryIndex - 1 : -1); }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.selectedCategoryIndex === -1) this.selectCategoryById(null);
      else {
        const c = this.categoriesFiltered[this.selectedCategoryIndex];
        if (c) this.selectCategoryById(c.id);
      }
      return;
    }
    if (event.key === 'Escape') {
      this.categoryQuery.set(''); this.categoriesFiltered = []; this.selectedCategoryIndex = -1;
      return;
    }
  }
  setCategoryIndex(i: number) { this.selectedCategoryIndex = i; }
  selectCategoryById(id: number | string | null) {
    this.form.patchValue({ categoryId: id });
    this.categoryQuery.set('');
    this.categoriesFiltered = [];
    this.selectedCategoryIndex = -1;
  }

  selectCategoryModal(id: number | string | null) {
    this.form.patchValue({ categoryId: id });
    this.categoryQuery.set('');
    this.categoriesFiltered = [];
    this.selectedCategoryIndex = -1;
  }

  // Autocomplete helpers for Tags (multi)
  onTagQueryInput(q: string) {
    this.tagQuery.set(q || '');
    this.applyTagFilter();
  }
  applyTagFilter() {
    const q = (this.tagQuery() || '').toLowerCase();
    if (!q) { this.tagsFiltered = this.tagsList.slice(0, 50); this.selectedTagIndex = this.tagsFiltered.length ? 0 : -1; return; }
    this.tagsFiltered = this.tagsList.filter(t => (t.name || '').toLowerCase().includes(q)).slice(0, 50);
    this.selectedTagIndex = this.tagsFiltered.length ? 0 : -1;
  }
  onTagKeydown(event: KeyboardEvent) {
    const len = (this.tagsFiltered?.length || 0);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (len === 0) { this.selectedTagIndex = -1; }
      else { this.selectedTagIndex = this.selectedTagIndex < len - 1 ? this.selectedTagIndex + 1 : -1; }
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (len === 0) { this.selectedTagIndex = -1; }
      else { this.selectedTagIndex = this.selectedTagIndex === -1 ? len - 1 : (this.selectedTagIndex > 0 ? this.selectedTagIndex - 1 : -1); }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.selectedTagIndex >= 0) {
        const t = this.tagsFiltered[this.selectedTagIndex]; if (t) this.pickTag(t.name);
      }
      return;
    }
    if (event.key === 'Escape') { this.tagQuery.set(''); this.tagsFiltered = []; this.selectedTagIndex = -1; return; }
  }
  setTagIndex(i: number) { this.selectedTagIndex = i; }
  pickTag(name: string) { const idx = (this.tagsFA.value as any[]).findIndex(v => v === name); if (idx > -1) this.removeTagAt(idx); else this.addTag(name); this.tagQuery.set(''); this.tagsFiltered = []; this.selectedTagIndex = -1; }

  // Autocomplete helpers for Packaging (multi)
  onPackagingQueryInput(q: string) { this.packagingQuery.set(q || ''); this.applyPackagingFilter(); }
  applyPackagingFilter() {
    const q = (this.packagingQuery() || '').toLowerCase();
    if (!q) { this.packagingFiltered = this.embalagensList.slice(0, 50); this.selectedPackagingIndex = this.packagingFiltered.length ? 0 : -1; return; }
    this.packagingFiltered = this.embalagensList.filter(p => (p.name || '').toLowerCase().includes(q)).slice(0, 50);
    this.selectedPackagingIndex = this.packagingFiltered.length ? 0 : -1;
  }
  onPackagingKeydown(event: KeyboardEvent) {
    const len = (this.packagingFiltered?.length || 0);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (len === 0) { this.selectedPackagingIndex = -1; }
      else { this.selectedPackagingIndex = this.selectedPackagingIndex < len - 1 ? this.selectedPackagingIndex + 1 : -1; }
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (len === 0) { this.selectedPackagingIndex = -1; }
      else { this.selectedPackagingIndex = this.selectedPackagingIndex === -1 ? len - 1 : (this.selectedPackagingIndex > 0 ? this.selectedPackagingIndex - 1 : -1); }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.selectedPackagingIndex >= 0) {
        const p = this.packagingFiltered[this.selectedPackagingIndex]; if (p) this.pickPackaging(p.name);
      }
      return;
    }
    if (event.key === 'Escape') { this.packagingQuery.set(''); this.packagingFiltered = []; this.selectedPackagingIndex = -1; return; }
  }
  setPackagingIndex(i: number) { this.selectedPackagingIndex = i; }
  pickPackaging(name: string) { const idx = (this.packagingFA.value as any[]).findIndex(v => v === name); if (idx > -1) this.removePackagingAt(idx); else this.addPackaging(name); this.packagingQuery.set(''); this.packagingFiltered = []; this.selectedPackagingIndex = -1; }

  onPackagingSelectChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const selected = Array.from(select.selectedOptions).map(o => o.value);
    // If user chose 'Outro', open modal for free-text and remove the marker
    if (selected.includes('__outro')) {
      const filtered = selected.filter(v => v !== '__outro');
      this.packagingFA.clear();
      filtered.forEach(val => { if (val) this.packagingFA.push(this.fb.control<string>(val)); });
      this.showPackagingModal = true;
      // Deselect the '__outro' option to avoid stuck selection
      setTimeout(() => { const opt = Array.from(select.options).find(o => o.value === '__outro'); if (opt) (opt as HTMLOptionElement).selected = false; }, 10);
      return;
    }
    this.packagingFA.clear();
    selected.forEach(val => { if (val) this.packagingFA.push(this.fb.control<string>(val)); });
  }

  editarProdutoExistente(p: ProdutoDto) {
    this.router.navigate(['/restrito/produto'], { queryParams: { produto_id: p.id } });
  }

  // helpers para template
  hasTag(name: string) { return this.tagsFA.controls.some(c => c.value === name); }

  // Fecha dropdown ao clicar fora
  // (Removido: duplicidade de ngAfterViewInit)

  ngOnDestroy() {
    try { document.removeEventListener('click', this.handleClickOutsideDropdown.bind(this)); } catch(e) {}
    try { if (this._docDragOverHandler) document.removeEventListener('dragover', this._docDragOverHandler); } catch(e) {}
    try { if (this._docDropHandler) document.removeEventListener('drop', this._docDropHandler); } catch(e) {}
    if (this.imagesSub) { this.imagesSub.unsubscribe(); this.imagesSub = null; }
  }

  openPreviewPage() {
    try {
      const data = this.previewProduct;
      if (typeof window !== 'undefined' && window && window.localStorage) {
        window.localStorage.setItem('admin:product_preview', JSON.stringify(data));
        window.open('/restrito/admin/produto-preview', '_blank');
      } else {
        this.router.navigate(['/restrito/admin/produto-preview']);
      }
    } catch (err) {
      console.error('openPreviewPage error', err);
      try { this.router.navigate(['/restrito/admin/produto-preview']); } catch(e) { /* noop */ }
    }
  }

  handleClickOutsideDropdown(event: MouseEvent) {
    const el = event.target as HTMLElement | null;
    if (el && el.closest && (el.closest('.menu') || el.closest('.icon-menu') || el.closest('.nav-overlay'))) return;
    const dropdown = document.querySelector('.custom-dropdown');
    if (dropdown && !dropdown.contains(event.target as Node)) {
      this.showCategoryDropdown = false;
    }
    // Fechar autocompletes ao clicar fora
    if (!(el && (el.closest('.formula-search-group') || el.closest('.sugestao-list')))) {
      this.categoriesFiltered = [];
      this.tagsFiltered = [];
      this.packagingFiltered = [];
    }
  }
  hasDosage(name: string) { return this.dosageFA.controls.some(c => c.value === name); }
  hasPackaging(name: string) { return this.packagingFA.controls.some(c => c.value === name); }

  reativarProdutoExistente(p: ProdutoDto) {
    // Placeholder: depende do backend ter campo status/active; por ora, navegar para edição
    this.editarProdutoExistente(p);
  }

  // Fórmula: seleção e derivação de estoques a partir dos ativos da fórmula
  onFormulaChange(formulaId: number | null) {
    // Define manipulado conforme presença de fórmula
    this.form.patchValue({ manipulado: !!formulaId });
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
      this.selectedFormulaIndex = this.formulasFiltered.length > 0 ? 0 : -1;
      return;
    }
    this.formulasFiltered = this.formulasAll.filter(ff => ((ff.name + ' ' + (ff.form_name || '')).toLowerCase().includes(q))).slice(0, 50);
    this.selectedFormulaIndex = this.formulasFiltered.length > 0 ? 0 : -1;
  }

  toggleFormulaEnabled() {
    this.formulaEnabled = !this.formulaEnabled;
    if (!this.formulaEnabled) {
      this.selectFormula(null);
    } else {
      setTimeout(() => {
        const el = document.getElementById('formulaInput') as HTMLInputElement | null;
        el?.focus();
      }, 10);
    }
  }

  setFormulaIndex(i: number) { this.selectedFormulaIndex = i; }

  selectFormula(id: number | null) {
    this.form.patchValue({ formulaId: id });
    this.onFormulaChange(id);
    this.formulaQuery.set('');
    this.formulasFiltered = [];
    this.selectedFormulaIndex = -1;
  }

  onFormulaKeydown(event: KeyboardEvent) {
    const len = (this.formulasFiltered?.length || 0);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (len === 0) { this.selectedFormulaIndex = -1; }
      else { this.selectedFormulaIndex = this.selectedFormulaIndex < len - 1 ? this.selectedFormulaIndex + 1 : -1; }
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (len === 0) { this.selectedFormulaIndex = -1; }
      else { this.selectedFormulaIndex = this.selectedFormulaIndex === -1 ? len - 1 : (this.selectedFormulaIndex > 0 ? this.selectedFormulaIndex - 1 : -1); }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.selectedFormulaIndex === -1) this.selectFormula(null);
      else {
        const f = this.formulasFiltered[this.selectedFormulaIndex];
        if (f) this.selectFormula(f.id);
      }
      return;
    }
    if (event.key === 'Escape') {
      this.formulaQuery.set(''); this.formulasFiltered = []; this.selectedFormulaIndex = -1;
      return;
    }
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
    console.log('openPromoModal called');
    try {
      this.promocaoSelecionada = null;
      // Always use dynamic overlay in browser to avoid *ngIf scoping issues
      if (typeof document === 'undefined') {
        // fallback for SSR/hosted render
        if (!this.promocoes || this.promocoes.length === 0) {
          this.promocoes = [];
          this.api.listPromocoes({ active: 1, page: 1, pageSize: 50 }).subscribe({
            next: (res) => { this.promocoes = res.data || []; },
            error: () => { this.promocoes = []; }
          });
        }
        this.showPromoModal = true;
        return;
      }

      // show overlay immediately (will display loading or items)
      this.showPromoOverlay();

      // load promos if not already loaded, then update list
      if (!this.promocoes || this.promocoes.length === 0) {
        this.promocoes = [];
        this.loadingPromos = true;
        this.api.listPromocoes({ active: 1, page: 1, pageSize: 50 }).subscribe({
          next: (res) => { this.promocoes = res.data || []; this.loadingPromos = false; this.updatePromoList(); },
          error: () => { this.promocoes = []; this.loadingPromos = false; this.updatePromoList(); }
        });
      } else {
        this.loadingPromos = false;
        this.updatePromoList();
      }
      console.log('openPromoModal finished, promocoes.length ->', (this.promocoes || []).length);
    } catch (err) {
      console.error('openPromoModal error', err);
    }
  }

  openCategoryModal(event?: Event) {
    try {
      try { this.removeStrayOverlays(); } catch(e) { /* noop */ }
      console.log('openCategoryModal called', event);
      event?.stopPropagation();
      this.zone.run(() => {
        this.showCategoryModal = true;
        try { this.cdr.detectChanges(); } catch (e) { /* noop */ }
      });
    } catch (err) {
      console.error('openCategoryModal error', err);
    }
  }

  openTagModal(event?: Event) {
    try {
      try { this.removeStrayOverlays(); } catch(e) { /* noop */ }
      console.log('openTagModal called', event);
      event?.stopPropagation();
      this.zone.run(() => {
        this.showTagModal = true;
        try { this.cdr.detectChanges(); } catch (e) { /* noop */ }
      });
    } catch (err) {
      console.error('openTagModal error', err);
    }
  }

  openPackagingModal(event?: Event) {
    try {
      try { this.removeStrayOverlays(); } catch(e) { /* noop */ }
      console.log('openPackagingModal called', event);
      event?.stopPropagation();
      this.zone.run(() => {
        this.showPackagingModal = true;
        try { this.cdr.detectChanges(); } catch (e) { /* noop */ }
      });
    } catch (err) {
      console.error('openPackagingModal error', err);
    }
  }

  // remove any leftover overlays appended to document.body (defensive)
  private removeStrayOverlays() {
    if (typeof document === 'undefined') return;
    try {
      const els = Array.from(document.querySelectorAll('.modal.dynamic-overlay'));
      els.forEach(e => { try { e.remove(); } catch(_) { /* noop */ } });
    } catch (e) { /* noop */ }
    this.promoOverlay = null;
    this.promoListContainer = null;
  }

  selectPackagingModal(item: any) {
    try {
      const name = item?.name || item;
      // use existing pickPackaging logic to toggle and clear filters
      this.pickPackaging(name);
      this.zone.run(() => {
        try { this.cdr.detectChanges(); } catch(e) { /* noop */ }
      });
    } catch (e) { console.error('selectPackagingModal error', e); }
  }

  selectTagModal(item: any) {
    try {
      const name = item?.name || item;
      this.pickTag(name);
      this.zone.run(() => { try { this.cdr.detectChanges(); } catch(e) { /* noop */ } });
    } catch (e) { console.error('selectTagModal error', e); }
  }

  // Create a simple DOM overlay attached to document.body (browser-only)
  private createOverlay(): HTMLDivElement | null {
    if (typeof document === 'undefined') return null;
    const overlay = document.createElement('div');
    overlay.className = 'modal dynamic-overlay';
    Object.assign(overlay.style as any, {
      position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.45)', padding: '20px'
    });
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) overlay.remove(); });
    return overlay;
  }

  private showPromoOverlay() {
    if (typeof document === 'undefined') return;
    // If overlay already exists, keep reference
    if (this.promoOverlay) return;
    const overlay = this.createOverlay();
    if (!overlay) return;
    this.promoOverlay = overlay;

    const modal = document.createElement('div');
    Object.assign(modal.style as any, { maxWidth: '920px', width: '100%', background: '#0d1419', borderRadius: '12px', padding: '18px', boxSizing: 'border-box', boxShadow: '0 16px 40px rgba(2,6,23,0.6)', color: '#fff', maxHeight: '90vh', overflow: 'auto' });

    const header = document.createElement('div'); header.style.display = 'flex'; header.style.justifyContent = 'space-between'; header.style.alignItems = 'center';
    const title = document.createElement('h2'); title.textContent = 'Selecionar Campanha'; title.style.margin = '0'; header.appendChild(title);
    const closeX = document.createElement('button'); closeX.textContent = '✕'; Object.assign(closeX.style as any, { background: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }); closeX.addEventListener('click', () => { overlay.remove(); this.promoOverlay = null; this.promoListContainer = null; try { this.zone.run(() => { this.showPromoModal = false; }); } catch(e) {} });
    header.appendChild(closeX);
    modal.appendChild(header);

    // search box
    const searchRow = document.createElement('div'); searchRow.style.margin = '12px 0';
    const searchInput = document.createElement('input'); searchInput.placeholder = 'Buscar campanha...'; Object.assign(searchInput.style as any, { width: '100%', boxSizing: 'border-box', maxWidth: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', background: '#071217', color: '#e6eef8' });
    searchRow.appendChild(searchInput);
    modal.appendChild(searchRow);

    // list container (kept in instance to update later)
    const list = document.createElement('div'); list.style.maxHeight = '60vh'; list.style.overflow = 'auto'; list.style.display = 'flex'; list.style.flexDirection = 'column'; list.style.gap = '12px'; list.style.boxSizing = 'border-box';
    this.promoListContainer = list;
    modal.appendChild(list);

    const footer = document.createElement('div'); footer.style.display = 'flex'; footer.style.justifyContent = 'flex-end'; footer.style.marginTop = '12px';
    const closeBtn = document.createElement('button'); closeBtn.textContent = 'Fechar'; Object.assign(closeBtn.style as any, { padding: '8px 12px', borderRadius: '8px' }); closeBtn.addEventListener('click', () => { overlay.remove(); this.promoOverlay = null; this.promoListContainer = null; try { this.zone.run(() => { this.showPromoModal = false; }); } catch(e) {} });
    footer.appendChild(closeBtn);
    modal.appendChild(footer);

    // keep reference to allow programmatic removal
    overlay.appendChild(modal); document.body.appendChild(overlay);
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) {
        overlay.remove();
        this.promoOverlay = null;
        this.promoListContainer = null;
        try { this.zone.run(() => { this.showPromoModal = false; }); } catch(e) {}
      }
    });

    // search filtering
    searchInput.addEventListener('input', () => { this.updatePromoList(searchInput.value || ''); });

    // initial populate (may show loading)
    this.updatePromoList();
  }

  // category overlay removed

  // tag overlay removed

  private updatePromoList(filter: string = '') {
    if (!this.promoListContainer) return;
    // clear
    this.promoListContainer.innerHTML = '';
    if (this.loadingPromos) {
      const loading = document.createElement('div'); loading.textContent = 'Carregando promoções...'; loading.style.padding = '12px'; loading.style.opacity = '0.9'; this.promoListContainer.appendChild(loading); return;
    }
    const items = (this.promocoes || []).filter(p => !filter || (p.nome || '').toLowerCase().includes(filter.toLowerCase()));
    if (!items.length) {
      const empty = document.createElement('div'); empty.textContent = 'Nenhuma promoção encontrada.'; empty.style.padding = '12px'; this.promoListContainer.appendChild(empty); return;
    }
    items.forEach(pr => {
      const item = document.createElement('div');
      Object.assign(item.style as any, { padding: '14px', borderRadius: '8px', background: '#0b1114', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.02)' });
      const left = document.createElement('div'); left.style.flex = '1';
      const rowTop = document.createElement('div'); rowTop.style.display = 'flex'; rowTop.style.justifyContent = 'space-between'; rowTop.style.alignItems = 'center';
      const name = document.createElement('div'); name.textContent = pr.nome || '—'; name.style.fontWeight = '800'; name.style.fontSize = '1rem';
      const st = (pr.ui && pr.ui.status) || '';
      const status = document.createElement('span'); status.textContent = this.promoStatusLabel(st);
      // status badge colors (keeps mapping by machine status)
      let bg = '#6b7280'; let color = '#fff';
      if (st === 'active') { bg = '#10b981'; color = '#072'; }
      else if (st === 'upcoming') { bg = '#f59e0b'; color = '#2b1a00'; }
      else if (st === 'expired' || st === 'inactive') { bg = '#374151'; color = '#cbd5e1'; }
      Object.assign(status.style as any, { background: bg, color: color, padding: '6px 8px', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 700, boxSizing: 'border-box' });
      rowTop.appendChild(name); rowTop.appendChild(status);
      left.appendChild(rowTop);

      if (pr.descricao) {
        const desc = document.createElement('div'); desc.textContent = pr.descricao; desc.style.opacity = '0.85'; desc.style.marginTop = '6px'; desc.style.fontSize = '0.95rem'; desc.style.color = '#cfe8ff'; left.appendChild(desc);
      }

      const metaRow = document.createElement('div'); metaRow.style.display = 'flex'; metaRow.style.gap = '12px'; metaRow.style.marginTop = '8px'; metaRow.style.alignItems = 'center';
      const valor = document.createElement('div'); valor.textContent = (pr.ui && pr.ui.valor_label) ? pr.ui.valor_label : (pr.tipo === 'percentual' ? (pr.valor + '%') : (pr.valor ? String(pr.valor) : ''));
      valor.style.opacity = '0.9'; valor.style.fontWeight = '700'; metaRow.appendChild(valor);
      if (pr.ui?.start?.human || pr.ui?.end?.human) {
        const dates = document.createElement('div'); dates.textContent = 'De: ' + (pr.ui?.start?.human || '—') + ' • Até: ' + (pr.ui?.end?.human || 'sem validade'); dates.style.opacity = '0.65'; dates.style.fontSize = '0.85rem'; metaRow.appendChild(dates);
      }
      left.appendChild(metaRow);

      const actions = document.createElement('div'); actions.style.display = 'flex'; actions.style.flexDirection = 'column'; actions.style.gap = '8px'; actions.style.alignItems = 'stretch'; actions.style.width = '120px';
      const applyBtn = document.createElement('button'); applyBtn.textContent = 'Aplicar'; Object.assign(applyBtn.style as any, { padding: '6px 12px', borderRadius: '6px', background: '#e6eef8', color: '#07121a', border: 'none', cursor: 'pointer', width: '100%', boxSizing: 'border-box' });
      applyBtn.addEventListener('click', (ev) => { ev.stopPropagation(); this.zone.run(() => { this.pickPromo(pr); }); if (this.promoOverlay) this.promoOverlay.remove(); this.promoOverlay = null; this.promoListContainer = null; });
      const detailBtn = document.createElement('button'); detailBtn.textContent = 'Detalhes'; Object.assign(detailBtn.style as any, { padding: '6px 12px', borderRadius: '6px', background: 'transparent', color: '#cfe8ff', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', width: '100%', boxSizing: 'border-box' });
      detailBtn.addEventListener('click', (ev) => { ev.stopPropagation(); this.zone.run(() => { this.openPromoDetail(pr.id); }); });
      actions.appendChild(applyBtn); actions.appendChild(detailBtn);
      item.appendChild(left); item.appendChild(actions);
      item.addEventListener('click', () => { this.zone.run(() => { this.pickPromo(pr); }); if (this.promoOverlay) this.promoOverlay.remove(); this.promoOverlay = null; this.promoListContainer = null; });
      this.promoListContainer!.appendChild(item);
    });
  }

  // When a promo is selected from modal/list, set it on component and close modal
  pickPromo(p: PromocaoDto | null) {
    this.promocaoSelecionada = p;
    this.showPromoModal = false;
  }

  openPromoDetail(promoId?: number | string) {
    if (promoId == null) return;
    const id = Number(promoId);
    if (isNaN(id)) return;
    this.api.getPromocao(id).subscribe({
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
        // Atualização local da lista para refletir imediatamente a nova taxonomia
        if (tipo === 'categorias') {
          const r: any = res;
          const newCat = { id: r.id, name: (r.nome || r.name || name) };
          this.categoriasList = [newCat, ...this.categoriasList];
          this.form.patchValue({ categoryId: r.id });
          this.showCategoryModal = false;
        }
      }
    });
  }
  updateTaxonomia(tipo: TaxonomyType, item: { id: number|string; name: string }, newName: string) {
    if (!newName) return;
    this.api.updateTaxonomia(tipo, item.id, newName).subscribe();
  }
  deleteTaxonomia(tipo: TaxonomyType, item: { id: number|string; name: string }) {
    this.api.deleteTaxonomia(tipo, item.id).subscribe();
  }

  // Mantém apenas a versão correta do resetForm
  // Atualizar resetForm para novo campo manipulado
  resetForm() { this.form.reset({ manipulado: false, active: 1, price: 0, weightValue: null, weightUnit: 'g' }); this.tagsFA.clear(); this.dosageFA.clear(); this.packagingFA.clear(); this.imagesFA.clear(); this.estoqueSelecionado = null; }

  fixRating(event: any) {
    const v = parseFloat(event.target.value);
    const bounded = isNaN(v) ? null : Math.max(0, Math.min(5, v));
    this.form.patchValue({ rating: bounded });
  }

  submit() {
    // require all required steps valid before submit (check all except last review step)
    for (let s = 0; s < this.steps.length - 1; s++) {
      if (!this.isStepValid(s)) { this.markStepTouched(s); this.error.set('Preencha os campos obrigatórios.'); return; }
    }
    this.error.set(null);
    this.saving.set(true);
    const fv: any = this.form?.value || {};
    // map tags names -> ids
    const tagNameToId = new Map(this.tagsList.map(t => [t.name, t.id] as [string, number | string]));
    const tag_ids = (this.tagsFA.value as string[] || [])
      .map(n => tagNameToId.get(n))
      .filter((v): v is number | string => v != null);
    const categoria_ids = fv.categoryId ? [fv.categoryId] : [];
    // imagens com posição: primeira do array é capa (posicao 0); se houver 'image' single, insere como capa antes da galeria
    const gallery: string[] = (this.imagesFA?.value || []) as string[];
    const imagens: Array<{ data: string; posicao: number }> = [];
    const cover = fv.image as string | null;
    let pos = 0;
    if (cover) { imagens.push({ data: cover as string, posicao: pos++ }); }
    gallery.forEach(img => { if (typeof img === 'string') imagens.push({ data: img, posicao: pos++ }); });

    const tipo: 'pronto' | 'manipulado' = fv.manipulado ? 'manipulado' : 'pronto';
    const parsedWeight = this.parseWeightValue(fv.weightValue);
    const body: any = {
      nome: fv.name,
      descricao: fv.description,
      preco: fv.price,
      tipo,
      ativo: fv.active ?? 1,
      destaque_home: this.destaqueHome ? 1 : 0,
      imagem_principal: this.imagemPrincipal,
      categoria_ids,
      tag_ids,
      imagens,
      customizations: {
        dosage: this.dosageFA.value ?? [],
        packaging: this.packagingFA.value ?? []
      },
      stock: fv.stock ?? null,
      weightValue: parsedWeight,
      weightUnit: fv.weightUnit ?? null,
      discount: fv.discount ?? null,
      rating: fv.rating ?? null,
      estoque_id: fv.estoqueId ?? null
    };
    if (tipo === 'manipulado') body.formula_id = fv.formulaId;
    // Se for edição de produto legado, usamos update antigo; para novo, usar endpoint full
    const legacyId = fv.id;
    let req$: any;
    if (legacyId) {
      const updateBody: any = {
        id: legacyId,
        name: fv.name,
        description: fv.description,
        price: fv.price,
        image: fv.image ?? null,
        category: (this.categoriasList.find((c: any) => c.id === fv.categoryId)?.name) || '',
        customizations: { dosage: this.dosageFA.value ?? [], packaging: this.packagingFA.value ?? [] },
        tags: this.tagsFA.value ?? [],
        discount: fv.discount ?? null,
        rating: fv.rating ?? null,
        stock: fv.stock ?? null,
        weightValue: parsedWeight,
        weightUnit: fv.weightUnit ?? null,
        formId: fv.formulaId ?? null,
        ativoId: fv.ativoId ?? null,
        estoqueId: fv.estoqueId ?? null
      };
      console.debug('update produto payload:', updateBody);
      req$ = this.api.updateProduto(legacyId, updateBody);
    } else {
      console.debug('create produto payload:', body);
      req$ = this.api.createMarketplaceProdutoFull(body);
    }
    req$.subscribe({
      next: (res: any) => {
        // Após criar, se houver promoção selecionada, vincular produto à promoção
        const newId = res?.id;
        const promoId = this.promocaoSelecionada?.id;
        if (!legacyId && newId && promoId) {
          this.api.setPromocaoProdutos(promoId, [Number(newId)]).subscribe({
            next: () => {
              this.saving.set(false);
              this.success.set('Produto salvo e campanha aplicada.');
              this.form.patchValue({ id: newId });
              if (this.embedded) {
                try { this.saved.emit({ id: newId, ...this.form.value }); } catch(e) {}
              }
            },
            error: () => {
              this.saving.set(false);
              this.success.set('Produto salvo. Falha ao aplicar campanha.');
              this.form.patchValue({ id: newId });
              if (this.embedded) {
                try { this.saved.emit({ id: newId, ...this.form.value }); } catch(e) {}
              }
            }
          });
          return;
        }
        this.saving.set(false); this.success.set('Produto salvo com sucesso.'); this.form.patchValue({ id: res.id });
        if (this.embedded) {
          try { this.saved.emit(res); } catch(e) { /* noop */ }
        }
      },
      error: (err: any) => {
        console.error(err);
        this.saving.set(false);
        // Se backend retornar 409 por existir produto com mesmo ativo, oferecemos reativar/editar
        if (err?.status === 409 && this.produtosExistentes.length) {
          const alvo = this.produtosExistentes[0]; // mais recente esperado primeiro pela API
          const wantReactivate = confirm('Já existe produto para este ativo. Deseja reativar o mais recente?');
          if (wantReactivate && alvo?.id != null) {
            this.saving.set(true);
            this.api.reativarProduto(alvo.id).subscribe({
              next: (r: any) => { this.saving.set(false); this.success.set('Produto reativado com sucesso.'); this.form.patchValue({ id: r.id }); },
              error: (e2: any) => { console.error(e2); this.saving.set(false); this.error.set('Falha ao reativar. Você pode editar o existente.'); }
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

  onCloseClick() {
    if (this.embedded) {
      try { this.closed.emit(); } catch(e) {}
    } else {
      try { this.router.navigate(['/restrito/lista-produtos']); } catch(e) {}
    }
  }

}
