import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService, Receita } from '../../../../services/api.service';
import { NavmenuComponent } from '../../../../navmenu/navmenu.component';

@Component({
  standalone: true,
  selector: 'app-receita-detalhe',
  imports: [CommonModule, RouterModule, NavmenuComponent],
  templateUrl: './receita-detalhe.component.html',
  styleUrls: ['./receita-detalhe.component.scss']
})
export class ReceitaDetalheComponent {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  carregando = true;
  erro: string | null = null;
  receita: Receita | null = null;

  get token(): string | null { return localStorage.getItem('token') || sessionStorage.getItem('token'); }

  ngOnInit() { this.load(); }

  async load() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.erro = 'Receita não encontrada'; this.carregando = false; return; }
    if (!this.token) { this.erro = 'Não autenticado'; this.carregando = false; return; }
    try {
      const data = await this.api.getReceitaById(this.token!, id).toPromise();
      this.receita = data || null;
    } catch (e: any) {
      this.erro = e?.error?.message || e?.message || 'Falha ao carregar receita';
    } finally {
      this.carregando = false;
    }
  }

  imprimir(): void {
    window.print();
  }
}
