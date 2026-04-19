// lista-produtos.component.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminPaginationComponent } from '../shared/admin-pagination/admin-pagination.component';
import { ButtonDirective, ButtonComponent } from '../../../../shared/button';
import { Router } from '@angular/router';
import { AdminApiService, Paged, ProdutoDto } from '../../../../services/admin-api.service';


@Component({
  selector: 'app-lista-produtos',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminPaginationComponent, ButtonDirective, ButtonComponent],
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
  selectedProduto?: ProdutoDto | null = undefined;
  showConfirmDelete = false;
  deleting = false;

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

  deleteProduto(produto: ProdutoDto) {
    if (!produto.id) return;
    this.selectedProduto = produto;
    this.showConfirmDelete = true;
  }

  cancelDelete() {
    this.showConfirmDelete = false;
    this.selectedProduto = undefined;
    this.deleting = false;
  }

  confirmDelete() {
    const produto = this.selectedProduto;
    if (!produto || !produto.id) { this.cancelDelete(); return; }
    this.deleting = true;
    this.api.deleteProduto(produto.id).subscribe({
      next: () => {
        this.produtos = this.produtos.filter(p => p.id !== produto.id);
        this.deleting = false;
        this.cancelDelete();
      },
      error: (err) => { console.error(err); this.deleting = false; alert('Erro ao excluir produto. Veja console.'); }
    });
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
    this.router.navigate(['/restrito/produto']);
  }

  toggleView() { this.isCardView = !this.isCardView; }

  // paginação simples
  canPrev() { return this.page > 1; }
  canNext() { return this.page * this.pageSize < this.total; }
  prev() { if (this.canPrev()) { this.page--; this.loadProdutos(); } }
  next() { if (this.canNext()) { this.page++; this.loadProdutos(); } }
}
