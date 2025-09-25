// lista-produtos.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { db } from '../../../../firebase-config';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';

interface Produto {
  id?: string; // Firestore id é string
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
export class ListaProdutosComponent implements OnInit {
  isCardView = true;
  produtos: Produto[] = [];
  loading = false;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loadProdutos();
  }

  async loadProdutos() {
    try {
      this.loading = true;
      const colRef = collection(db, 'produtos');
      const snapshot = await getDocs(colRef);
      this.produtos = snapshot.docs.map(d => {
        const data = d.data() as any;
        return { id: d.id, ...data } as Produto;
      });
      console.log('Produtos carregados:', this.produtos);
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
    } finally {
      this.loading = false;
    }
  }

  editProduto(produto: Produto) {
    this.router.navigate(['/restrito/produto'], { queryParams: { produto_id: produto.id } });
  }

  async deleteProduto(produto: Produto) {
    if (!produto.id) return;
    if (!confirm(`Deseja realmente excluir "${produto.name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'produtos', produto.id));
      // remove localmente pra UX imediata
      this.produtos = this.produtos.filter(p => p.id !== produto.id);
    } catch (err) {
      console.error('Erro ao excluir produto:', err);
      alert('Erro ao excluir produto. Veja console.');
    }
  }

  addProduto() {
    this.router.navigate(['/restrito/produto']);
  }

  toggleView() { this.isCardView = !this.isCardView; }
}
