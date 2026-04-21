import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FormSchema } from '../../../../shared/admin-crud/form-schema';
import { RouterModule } from '@angular/router';
import { map } from 'rxjs/operators';
import { AdminPaginationComponent } from '../shared/admin-pagination/admin-pagination.component';
import { ButtonDirective, ButtonComponent } from '../../../../shared/button';
import { AdminApiService, PromocaoDto, ProdutoDto } from '../../../../services/admin-api.service';
import { AdminCrudComponent } from '../../../../shared/admin-crud/admin-crud.component';
import { EntityLookupComponent } from '../../../../shared/entity-lookup/entity-lookup.component';

@Component({
  selector: 'app-admin-promocoes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, AdminPaginationComponent, ButtonDirective, ButtonComponent, AdminCrudComponent, EntityLookupComponent],
  templateUrl: './promocoes.component.html',
  styleUrls: ['./promocoes.component.scss']
})
export class AdminPromocoesComponent implements OnInit {

  // listagem
  q = signal('');
  page = signal(1);
  pageSize = signal(10);
  active = signal<'all' | '1' | '0'>('all');
  loadingList = signal(false);
  list = signal<PromocaoDto[]>([]);
  total = signal(0);

  // edição/criação
  editingId = signal<number | null>(null);
  showCreateModal = signal(false);
  // seleção de produtos vinculados (IDs)
  produtosVinculados = signal<number[]>([]);
  // schema-driven form config
  promocoesFormSchema: FormSchema | null = null;
  // object passed to admin-crud as editItem
  editingItem: any | null = null;

  constructor(private api: AdminApiService) {}

  ngOnInit(): void {
    this.loadList();
    this.promocoesFormSchema = {
      title: 'Promoção',
      submitLabel: 'Salvar',
      fields: [
        { key: 'nome', label: 'Nome', type: 'text', required: true },
        { key: 'descricao', label: 'Descrição', type: 'textarea' },
        { key: 'tipo', label: 'Tipo', type: 'select', options: [{ value: 'percentual', label: 'Percentual' }, { value: 'valor', label: 'Valor' }], default: 'percentual' },
        { key: 'valor', label: 'Valor', type: 'number', required: true, default: 0 },
        { key: 'inicio', label: 'Início', type: 'datetime' },
        { key: 'fim', label: 'Fim', type: 'datetime' },
        { key: 'ativo', label: 'Ativa', type: 'checkbox', default: true },
        { key: 'produtos', label: 'Produtos vinculados', type: 'multi-suggest', placeholder: 'Buscar produtos pelo nome', searchFn: this.searchProdutos.bind(this) }
      ]
    };
  }

  loadList() {
    this.loadingList.set(true);
    const params: any = { q: this.q(), page: this.page(), pageSize: this.pageSize() };
    if (this.active() !== 'all') params.active = this.active() === '1' ? 1 : 0;
    this.api.listPromocoes(params).subscribe({
      next: (res: any) => {
        this.list.set(res.items ?? res.data ?? []);
        this.total.set(res.total ?? 0);
        this.loadingList.set(false);
      },
      error: () => this.loadingList.set(false)
    });
  }

  totalPages(): number {
    const size = this.pageSize();
    const total = this.total();
    return size > 0 ? Math.max(1, Math.ceil(total / size)) : 1;
  }
  canPrev(): boolean { return this.page() > 1; }
  canNext(): boolean { return this.page() < this.totalPages(); }
  prevPage() { if (this.canPrev()) { this.page.set(this.page() - 1); this.loadList(); } }
  nextPage() { if (this.canNext()) { this.page.set(this.page() + 1); this.loadList(); } }

  // Helpers de exibição
  formatValor(p: PromocaoDto): string {
    const v = Number((p.valor as any) ?? 0);
    if ((p.tipo || 'percentual') === 'percentual') return `${v}%`;
    try { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); } catch { return `R$ ${v.toFixed(2)}`; }
  }
  statusLabel(p: PromocaoDto): string {
    const ativo = (p.ativo ? 1 : 0) === 1;
    const now = new Date();
    const ini = p.inicio ? new Date(p.inicio) : null;
    const fim = p.fim ? new Date(p.fim) : null;
    if (!ativo) return 'Inativa';
    if (ini && now < ini) return 'Agendada';
    if (fim && now > fim) return 'Expirada';
    if (!ini && !fim) return 'Sem janela';
    return 'Em vigor';
  }
  statusClass(p: PromocaoDto): string {
    const label = this.statusLabel(p);
    switch (label) {
      case 'Em vigor': return 'ok';
      case 'Agendada': return 'info';
      case 'Sem janela': return 'muted';
      case 'Expirada': return 'warn';
      default: return 'off';
    }
  }

  resetEditor() {
    this.editingId.set(null);
    this.editingItem = null;
    this.produtosVinculados.set([]);
  }

  novaPromocao() {
    this.resetEditor();
    this.showCreateModal.set(true);
  }

  editarPromocao(p: PromocaoDto) {
    if (!p.id) return;
    this.editingId.set(p.id);
    this.api.getPromocao(p.id).subscribe((det: PromocaoDto) => {
      const produtosArr = (det.produtos ?? []).map((x: any) => ({
        id: Number(x.id),
        name: x.nome ?? x.name ?? '',
        price: Number(x.preco ?? x.price ?? 0)
      }));
      const ids = produtosArr.map((it: any) => Number(it.id));
      this.produtosVinculados.set(ids);
      this.editingItem = {
        id: det.id,
        nome: det.nome,
        descricao: det.descricao ?? '',
        tipo: det.tipo ?? 'percentual',
        valor: det.valor ?? 0,
        inicio: det.inicio ?? '',
        fim: det.fim ?? '',
        ativo: !!(det.ativo ?? true),
        produtos: produtosArr
      };
      // Open the drawer with the loaded promotion data
      this.showCreateModal.set(true);
    });
  }

  onSchemaSubmit(ev: { id?: any; values: any }) {
    const id = ev.id;
    const values = ev.values || {};
    const body: PromocaoDto = {
      nome: values.nome,
      descricao: values.descricao || undefined,
      tipo: values.tipo || 'percentual',
      valor: Number(values.valor || 0),
      inicio: values.inicio || undefined,
      fim: values.fim || undefined,
      ativo: !!values.ativo
    } as any;

    const productIds: number[] = Array.isArray(values.produtos) ? values.produtos.map((x: any) => Number(x)) : [];

    const afterSave = (saved: PromocaoDto) => {
      if (productIds.length) {
        this.api.setPromocaoProdutos(saved.id!, productIds).subscribe(() => {
          this.resetEditor();
          this.showCreateModal.set(false);
          this.loadList();
        });
      } else {
        this.resetEditor();
        this.showCreateModal.set(false);
        this.loadList();
      }
    };

    if (id) this.api.updatePromocao(id, body).subscribe(afterSave);
    else this.api.createPromocao(body).subscribe(afterSave);
  }

  remover(p: PromocaoDto) {
    if (!p.id) return;
    if (confirm(`Remover promoção "${p.nome}"?`)) {
      this.api.deletePromocao(p.id).subscribe(() => this.loadList());
    }
  }

  // Produtos - busca e seleção
  buscarProdutos() {
    // This method is no longer needed as product search is handled by EntityLookup
  }

  // New helper to provide a search function to the EntityLookup component
  searchProdutos(q: string) {
    return this.api.listProdutos({ q, page: 1, pageSize: 10, active: 1 }).pipe(
      map((res: any) => (res.data || []).map((p: any) => ({ id: Number(p.id), name: p.nome ?? p.name ?? '', price: Number(p.preco ?? p.price ?? 0) })))
    );
  }
  // addProduto/removeProduto removed: EntityLookup now manages selection

  // Filtros
  onQInput(ev: Event) {
    const value = (ev.target as HTMLInputElement).value;
    this.q.set(value);
    this.loadList();
  }
  onActiveChange(ev: Event) {
    const value = (ev.target as HTMLSelectElement).value as 'all' | '1' | '0';
    this.active.set(value);
    this.loadList();
  }

  onDrawerOpenChange(open: boolean) {
    // Keep parent state in sync with the drawer's internal state. When the drawer
    // is closed via backdrop/ESC the SideDrawer emits openChange(false) but the
    // component-level `showCreateModal` could still be true — leaving the parent
    // thinking the drawer is open. Sync the signal and reset editor when closed.
    this.showCreateModal.set(open);
    if (!open) this.resetEditor();
  }

  closeCreateModal(){ this.resetEditor(); this.showCreateModal.set(false); }
}
