// produto-list.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface Produto {
  id?: number;
  name: string;
  description: string;
  price: number;
  image?: string;
  category: string;
  customizations: {
    dosage: string[];
    packaging: string[];
  };
  discount?: number;
  rating?: number;
  stock?: number;
  tags: string[];
  weight?: string;
  weightUnit?: string;
  weightValue?: number;
  isFavourite?: boolean;
  isAddedToCart?: boolean;
}

@Component({
  selector: 'app-lista-produtos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lista-produtos.component.html',
  styleUrl: './lista-produtos.component.scss'
})
export class ProdutoListComponent implements OnInit {
  isCardView = true;


  produtos: Produto[] = [];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loadProdutos();
  }

  loadProdutos() {
    const produtosStored = localStorage.getItem('produtos');
    this.produtos = produtosStored ? JSON.parse(produtosStored) : [];
  }

  editProduto(produto: Produto) {
    this.router.navigate(['/restrito/produto'], { queryParams: { produto_id: produto.id } });
  }

  deleteProduto(produto: Produto) {
    if (confirm(`Deseja realmente excluir "${produto.name}"?`)) {
      this.produtos = this.produtos.filter(p => p.id !== produto.id);
      localStorage.setItem('produtos', JSON.stringify(this.produtos));
    }
  }

  addProduto() {
    this.router.navigate(['/restrito/produto']);
  }

   toggleView() { this.isCardView = !this.isCardView; }
}
