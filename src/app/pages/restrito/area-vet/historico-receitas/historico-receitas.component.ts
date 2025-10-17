import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { ApiService, PagedReceitasResponse, Receita } from '../../../../services/api.service';
import { NavmenuComponent } from '../../../../navmenu/navmenu.component';

@Component({
  standalone: true,
  selector: 'app-historico-receitas',
  imports: [CommonModule, FormsModule, RouterModule, NavmenuComponent],
  templateUrl: './historico-receitas.component.html',
  styleUrls: ['./historico-receitas.component.scss']
})
export class HistoricoReceitasComponent {
  private api = inject(ApiService);
  private router = inject(Router);

  carregando = false;
  erro: string | null = null;

  // filtros
  q = '';
  from = '';
  to = '';
  pet_id: string = '';
  cliente_id: string = '';
  ativo_id: string = '';

  // paginação
  page = 1;
  pageSize = 20;
  total = 0;
  totalPages = 0;

  receitas: Receita[] = [];

  ngOnInit() {
    this.load();
  }

  get token(): string | null {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  }

  async load() {
    if (!this.token) { this.erro = 'Não autenticado'; return; }
    this.carregando = true;
    this.erro = null;
    try {
      const resp = await this.api.getReceitas(this.token!, {
        page: this.page, pageSize: this.pageSize,
        pet_id: this.pet_id || undefined,
        cliente_id: this.cliente_id || undefined,
        ativo_id: this.ativo_id || undefined,
        from: this.from || undefined,
        to: this.to || undefined,
        q: this.q || undefined
      }).toPromise();
      if (!resp) throw new Error('Sem resposta do servidor');
      this.receitas = resp.data || [];
      this.page = resp.page || 1;
      this.pageSize = resp.pageSize || this.pageSize;
      this.total = resp.total || 0;
      this.totalPages = resp.totalPages || 0;
    } catch (e: any) {
      this.erro = e?.error?.message || e?.message || 'Falha ao carregar histórico';
    } finally {
      this.carregando = false;
    }
  }

  resetarFiltros() {
    this.q = this.from = this.to = this.pet_id = this.cliente_id = this.ativo_id = '';
    this.page = 1;
    this.load();
  }

  abrirReceita(r: Receita) {
    if (!r?.id) return;
    this.router.navigate(['/historico-receitas', r.id]);
  }

  paginaAnterior() { if (this.page > 1) { this.page--; this.load(); } }
  proximaPagina() { if (this.page < this.totalPages) { this.page++; this.load(); } }

  copyId(r: Receita, ev?: Event) {
    ev?.stopPropagation();
    try {
      const text = String(r?.id ?? '');
      if (!text) return;
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    } catch {}
  }
}
