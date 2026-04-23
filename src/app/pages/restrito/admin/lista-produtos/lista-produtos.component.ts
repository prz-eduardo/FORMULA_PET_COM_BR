import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminPaginationComponent } from '../shared/admin-pagination/admin-pagination.component';
import { ButtonDirective, ButtonComponent } from '../../../../shared/button';
import { AdminCrudComponent, ColumnDef } from '../../../../shared/admin-crud/admin-crud.component';
import { ProdutoComponent } from '../produto/produto.component';
import { Router } from '@angular/router';
import { AdminApiService, ProdutoDto } from '../../../../services/admin-api.service';
import { environment } from '../../../../../enviroments/environment';

@Component({
  selector: 'app-lista-produtos',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AdminPaginationComponent, ButtonDirective, ButtonComponent, AdminCrudComponent, ProdutoComponent],
  templateUrl: './lista-produtos.component.html',
  styleUrls: ['./lista-produtos.component.scss']
})
export class ListaProdutosComponent implements OnInit {
  private api = inject(AdminApiService);
  private fb = inject(FormBuilder);
  constructor(private router: Router) {}

  isCardView = true;
  produtos: ProdutoDto[] = [];
  loading = false;
  error: string | null = null;

  q = '';
  category = '';
  tag = '';
  active: 1 | 0 | undefined = undefined;
  page = 1;
  pageSize = 12;
  total = 0;
  deleting = false;
  submitting = signal(false);

  drawerOpen = false;
  drawerEditItem: ProdutoDto | null = null;

  produtoForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    price: [0, [Validators.required]],
    description: [''],
    category: [''],
    tags: [''],
    active: [true]
  });

  columns: ColumnDef[] = [
    { key: 'id', label: 'ID', width: '70px' },
    { key: 'name', label: 'Nome' },
    { key: 'price', label: 'Preço', width: '120px' },
    { key: 'category', label: 'Categoria', width: '160px' },
    { key: 'active', label: 'Ativo', width: '120px' }
  ];

  get drawerTitleLabel(): string {
    return this.drawerEditItem?.id != null ? `Produto #${this.drawerEditItem.id}` : 'Novo produto';
  }

  get drawerSubtitleText(): string | undefined {
    if (this.drawerEditItem?.id == null) return undefined;
    const n = this.drawerEditItem.name?.trim();
    return n || undefined;
  }

  ngOnInit(): void {
    this.loadProdutos();
  }

  loadProdutos() {
    this.loading = true; this.error = null;
    this.api.listProdutos({ q: this.q || undefined, category: this.category || undefined, tag: this.tag || undefined, active: this.active, page: this.page, pageSize: this.pageSize })
      .subscribe({
        next: (res) => { this.produtos = res.data; this.total = res.total; this.loading = false; },
        error: (err) => { console.error(err); this.error = 'Erro ao carregar produtos.'; this.loading = false; }
      });
  }

  editProduto(produto: ProdutoDto) {
    this.router.navigate(['/restrito/produto'], { queryParams: { produto_id: produto.id } });
  }

  irParaAssistenteProduto(): void {
    const id = this.drawerEditItem?.id;
    if (id == null) return;
    this.closeDrawer();
    this.router.navigate(['/restrito/produto'], { queryParams: { produto_id: String(id) } });
  }

  formatBRL(v: number | string | null | undefined): string {
    const n = typeof v === 'number' ? v : (v != null && v !== '' ? parseFloat(String(v).replace(',', '.')) : NaN);
    if (Number.isNaN(n)) return '—';
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatDatePt(iso?: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  resolveProductImage(p: ProdutoDto | null): string {
    if (!p) return '/imagens/image.png';
    const anyp = p as any;
    const raw = (typeof p.image === 'string' && p.image) || (Array.isArray(anyp.images) && anyp.images[0]) || '';
    if (!raw || typeof raw !== 'string') return '/imagens/image.png';
    let url = raw.trim();
    if (url.startsWith('//')) url = window.location.protocol + url;
    if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
    if (url.startsWith('/')) return url;
    const base = (environment.apiBaseUrl || '').replace(/\/$/, '');
    return base ? `${base}/${url.replace(/^\//, '')}` : url;
  }

  isProdutoAtivo(p: ProdutoDto | null): boolean {
    if (!p) return false;
    return p.active === 1 || (p.active as any) === true;
  }

  produtoTagsList(p: ProdutoDto | null): string[] {
    if (!p?.tags) return [];
    return Array.isArray(p.tags) ? p.tags.filter((t): t is string => typeof t === 'string' && !!t.trim()) : [];
  }

  textoOuTraco(v?: string | null): string {
    const s = v?.trim();
    return s ? s : '—';
  }

  onRemove(item: any) {
    const produto = item as ProdutoDto;
    if (!produto?.id) return;
    this.deleting = true;
    this.api.deleteProduto(produto.id).subscribe({
      next: () => {
        this.produtos = this.produtos.filter(p => p.id !== produto.id);
        this.deleting = false;
      },
      error: (err) => { console.error(err); this.deleting = false; alert('Erro ao excluir produto. Veja console.'); }
    });
  }

  private resetProdutoForm(item?: any) {
    const it: any = item || {};
    this.produtoForm.reset({
      name: it.name || '',
      price: typeof it.price === 'number' ? it.price : (it.price ? Number(it.price) : 0),
      description: it.description || '',
      category: it.category || '',
      tags: Array.isArray(it.tags) ? it.tags.join(', ') : (it.tags || ''),
      active: it.active === undefined ? true : (it.active === 1 || it.active === true)
    });
  }

  openDrawer(produto: ProdutoDto) {
    if (!produto) {
      this.drawerEditItem = null;
      this.resetProdutoForm();
      this.drawerOpen = true;
      return;
    }

    if (produto.id) {
      const prevLoading = this.loading;
      this.loading = true;
      this.api.getProduto(produto.id).subscribe({
        next: (p) => {
          const clone: any = { ...p };
          if (Array.isArray(clone.tags)) clone.tags = clone.tags.join(', ');
          this.drawerEditItem = clone;
          this.resetProdutoForm(clone);
          this.drawerOpen = true;
          this.loading = prevLoading;
        },
        error: (err) => {
          console.error(err);
          this.loading = prevLoading;
          alert('Erro ao carregar dados do produto. Veja console.');
        }
      });
      return;
    }

    const clone: any = { ...produto };
    if (Array.isArray(clone.tags)) clone.tags = clone.tags.join(', ');
    this.drawerEditItem = clone;
    this.resetProdutoForm(clone);
    this.drawerOpen = true;
  }

  closeDrawer() {
    this.drawerEditItem = null;
    this.drawerOpen = false;
  }

  onDrawerOpenChange(open: boolean) {
    this.drawerOpen = open;
    if (!open) this.drawerEditItem = null;
  }

  onProductSaved(_produto: any) {
    this.closeDrawer();
    this.loadProdutos();
  }

  submitProduto() {
    if (this.produtoForm.invalid) { this.produtoForm.markAllAsTouched(); return; }
    const values = this.produtoForm.value;
    const tags = typeof values.tags === 'string'
      ? values.tags.split(',').map((s: string) => s.trim()).filter((s: string) => !!s)
      : (Array.isArray(values.tags) ? values.tags : []);
    const payload: any = {
      name: values.name,
      price: typeof values.price === 'string' ? parseFloat(String(values.price).replace(',', '.')) || 0 : Number(values.price || 0),
      description: values.description || '',
      category: values.category || '',
      tags,
      active: values.active ? 1 : 0
    };
    const id = this.drawerEditItem?.id;
    this.submitting.set(true);

    const after = () => {
      this.submitting.set(false);
      this.closeDrawer();
      this.loadProdutos();
    };

    if (id) {
      this.api.updateProduto(id, payload).subscribe({
        next: after,
        error: (err) => { this.submitting.set(false); console.error(err); alert('Erro ao atualizar produto. Veja console.'); }
      });
    } else {
      this.api.createProduto(payload).subscribe({
        next: after,
        error: (err) => { this.submitting.set(false); console.error(err); alert('Erro ao criar produto. Veja console.'); }
      });
    }
  }

  removerEditando() {
    const item = this.drawerEditItem;
    if (!item?.id) return;
    if (!confirm('Deseja realmente excluir este produto?')) return;
    this.api.deleteProduto(item.id).subscribe({
      next: () => { this.closeDrawer(); this.loadProdutos(); },
      error: (err) => { console.error(err); alert('Erro ao excluir produto. Veja console.'); }
    });
  }

  deleteProduto(produto: ProdutoDto) {
    if (!produto?.id) return;
    if (!confirm || confirm('Deseja realmente excluir este produto?')) {
      this.deleting = true;
      this.api.deleteProduto(produto.id).subscribe({
        next: () => {
          this.produtos = this.produtos.filter(p => p.id !== produto.id);
          this.deleting = false;
        },
        error: (err) => { console.error(err); this.deleting = false; alert('Erro ao excluir produto. Veja console.'); }
      });
    }
  }

  toggleActive(produto: ProdutoDto) {
    if (!produto.id) return;
    const novo = (produto.active === 1) ? 0 : 1;
    this.api.updateProduto(produto.id, { active: novo }).subscribe({
      next: (p) => {
        const idx = this.produtos.findIndex(x => x.id === produto.id);
        if (idx > -1) this.produtos[idx] = { ...this.produtos[idx], active: (p as any)?.active ?? novo };
      },
      error: (err) => { console.error(err); alert('Erro ao atualizar status do produto.'); }
    });
  }

  addProduto() {
    this.drawerEditItem = null;
    this.resetProdutoForm();
    this.drawerOpen = true;
  }

  toggleView() { this.isCardView = !this.isCardView; }

  canPrev() { return this.page > 1; }
  canNext() { return this.page * this.pageSize < this.total; }
  prev() { if (this.canPrev()) { this.page--; this.loadProdutos(); } }
  next() { if (this.canNext()) { this.page++; this.loadProdutos(); } }
}
