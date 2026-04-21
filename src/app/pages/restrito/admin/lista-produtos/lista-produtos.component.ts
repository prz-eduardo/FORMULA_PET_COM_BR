// lista-produtos.component.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminPaginationComponent } from '../shared/admin-pagination/admin-pagination.component';
import { ButtonDirective, ButtonComponent } from '../../../../shared/button';
import { AdminCrudComponent, ColumnDef } from '../../../../shared/admin-crud/admin-crud.component';
import { FormSchema } from '../../../../shared/admin-crud/form-schema';
import { ProdutoComponent } from '../produto/produto.component';
import { Router } from '@angular/router';
import { AdminApiService, Paged, ProdutoDto } from '../../../../services/admin-api.service';


@Component({
  selector: 'app-lista-produtos',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminPaginationComponent, ButtonDirective, ButtonComponent, AdminCrudComponent, ProdutoComponent],
  templateUrl: './lista-produtos.component.html',
  styleUrls: ['./lista-produtos.component.scss']
})
export class ListaProdutosComponent implements OnInit {
  private api = inject(AdminApiService);
  constructor(private router: Router) {}

  isCardView = true;
  produtos: ProdutoDto[] = [];
  loading = false;
  error: string | null = null;

  // filtros e paginação
  q = '';
  category = '';
  tag = '';
  active: 1 | 0 | undefined = undefined;
  page = 1;
  pageSize = 12;
  total = 0;
  // confirmação de exclusão
  // remoção agora via admin-crud (evento remove). manter flag para bloquear botões
  deleting = false;

  // drawer prototype state (fase 1 protótipo)
  drawerOpen = false;
  drawerEditItem: ProdutoDto | null = null;

  // admin-crud schema and columns for quick product editor
  columns: ColumnDef[] = [
    { key: 'id', label: 'ID', width: '70px' },
    { key: 'name', label: 'Nome' },
    { key: 'price', label: 'Preço', width: '120px' },
    { key: 'category', label: 'Categoria', width: '160px' },
    { key: 'active', label: 'Ativo', width: '120px' }
  ];

  productFormSchema: FormSchema = {
    title: 'Produto',
    submitLabel: 'Salvar',
    allowDelete: true,
    fields: [
      { key: 'name', label: 'Nome', type: 'text', required: true },
      { key: 'price', label: 'Preço', type: 'number', required: true },
      { key: 'description', label: 'Descrição', type: 'textarea' },
      { key: 'category', label: 'Categoria', type: 'text' },
      { key: 'tags', label: 'Tags (separadas por vírgula)', type: 'text', placeholder: 'ex: cat, cachorro' },
      { key: 'active', label: 'Ativo', type: 'checkbox' }
    ]
  };

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

  // usado pelo `app-admin-crud` (evento remove) para executar remoção direta
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

  // abrir protótipo de editor no drawer
  openDrawer(produto: ProdutoDto) {
    // If no produto passed, open drawer for creation
    if (!produto) {
      this.drawerEditItem = null;
      this.drawerOpen = true;
      return;
    }

    // If produto has an id, fetch full data from backend before opening editor
    if (produto.id) {
      // small loading flag so list spinner isn't affected
      const prevLoading = this.loading;
      this.loading = true;
      this.api.getProduto(produto.id).subscribe({
        next: (p) => {
          const clone: any = { ...p };
          if (Array.isArray(clone.tags)) clone.tags = clone.tags.join(', ');
          this.drawerEditItem = clone;
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

    // fallback: open editor with shallow item
    const clone: any = { ...produto };
    if (Array.isArray(clone.tags)) clone.tags = clone.tags.join(', ');
    this.drawerEditItem = clone;
    this.drawerOpen = true;
  }

  closeDrawer() {
    this.drawerEditItem = null;
    this.drawerOpen = false;
  }

  onProductSaved(produto: any) {
    this.closeDrawer();
    // refresh list to reflect changes
    this.loadProdutos();
  }

  // handler for admin-crud auto-form submit
  onFormSubmit(evt: { id?: any; values: any }) {
    const values = { ...evt.values };
    const tags = typeof values.tags === 'string' ? values.tags.split(',').map((s: string) => s.trim()).filter((s: string) => !!s) : (Array.isArray(values.tags) ? values.tags : []);
    const payload: any = {
      name: values.name,
      price: (typeof values.price === 'string') ? parseFloat(values.price.replace(',', '.')) || 0 : (typeof values.price === 'number' ? values.price : 0),
      description: values.description || '',
      category: values.category || '',
      tags,
      active: values.active ? 1 : 0
    };

    if (evt.id) {
      this.api.updateProduto(evt.id, payload).subscribe({
        next: () => { this.closeDrawer(); this.loadProdutos(); },
        error: (err) => { console.error(err); alert('Erro ao atualizar produto. Veja console.'); }
      });
    } else {
      this.api.createProduto(payload).subscribe({
        next: () => { this.closeDrawer(); this.loadProdutos(); },
        error: (err) => { console.error(err); alert('Erro ao criar produto. Veja console.'); }
      });
    }
  }

  // deletion from inline buttons now performs direct delete via API (no modal)
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
        // atualizar item localmente para refletir estado sem recarregar
        const idx = this.produtos.findIndex(x => x.id === produto.id);
        if (idx > -1) this.produtos[idx] = { ...this.produtos[idx], active: (p as any)?.active ?? novo };
      },
      error: (err) => { console.error(err); alert('Erro ao atualizar status do produto.'); }
    });
  }

  addProduto() {
    // abrir editor embutido no drawer para criação
    this.drawerEditItem = null;
    this.drawerOpen = true;
  }

  toggleView() { this.isCardView = !this.isCardView; }

  // paginação simples
  canPrev() { return this.page > 1; }
  canNext() { return this.page * this.pageSize < this.total; }
  prev() { if (this.canPrev()) { this.page--; this.loadProdutos(); } }
  next() { if (this.canNext()) { this.page++; this.loadProdutos(); } }
}
