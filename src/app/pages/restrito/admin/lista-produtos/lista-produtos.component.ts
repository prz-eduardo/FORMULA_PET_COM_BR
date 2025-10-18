// lista-produtos.component.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminApiService, Paged, ProdutoDto } from '../../../../services/admin-api.service';


@Component({
  selector: 'app-lista-produtos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lista-produtos.component.html',
  styleUrl: './lista-produtos.component.scss'
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
    if (!confirm(`Deseja realmente excluir "${produto.name}"?`)) return;
    this.api.deleteProduto(produto.id).subscribe({
      next: () => this.produtos = this.produtos.filter(p => p.id !== produto.id),
      error: (err) => { console.error(err); alert('Erro ao excluir produto. Veja console.'); }
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
