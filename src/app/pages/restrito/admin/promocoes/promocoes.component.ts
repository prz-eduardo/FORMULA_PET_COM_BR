import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { map } from 'rxjs/operators';
import { AdminPaginationComponent } from '../shared/admin-pagination/admin-pagination.component';
import { ButtonDirective, ButtonComponent } from '../../../../shared/button';
import { AdminApiService, PromocaoDto } from '../../../../services/admin-api.service';
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

  // edição / criação
  editingId = signal<number | null>(null);
  showCreateModal = signal(false);
  submitting = signal(false);

  // produtos vinculados (para o entity-lookup)
  selectedProdutoIds = signal<number[]>([]);
  selectedProdutos = signal<Array<{ id: number; name?: string; price?: number }>>([]);

  promoForm!: FormGroup;
  drawerOpen = computed(() => this.showCreateModal() || !!this.editingId());

  searchProdutosFn = (q: string) => this.api.listProdutos({ q, page: 1, pageSize: 10, active: 1 }).pipe(
    map((res: any) => (res.data || []).map((p: any) => ({
      id: Number(p.id),
      name: p.nome ?? p.name ?? '',
      price: Number(p.preco ?? p.price ?? 0)
    })))
  );

  constructor(private api: AdminApiService, private fb: FormBuilder) {}

  ngOnInit(): void {
    this.resetPromoForm();
    this.loadList();
  }

  resetPromoForm(det?: PromocaoDto | null) {
    const d: any = det || {};
    this.promoForm = this.fb.group({
      nome: [d.nome || '', [Validators.required, Validators.minLength(2)]],
      descricao: [d.descricao || ''],
      tipo: [d.tipo || 'percentual', Validators.required],
      valor: [d.valor ?? 0, [Validators.required]],
      inicio: [this.toInputDT(d.inicio)],
      fim: [this.toInputDT(d.fim)],
      ativo: [!!(d.ativo ?? true)]
    });
  }

  private toInputDT(iso: any): string {
    if (!iso) return '';
    try {
      const d = iso instanceof Date ? iso : new Date(String(iso));
      if (isNaN(d.getTime())) return '';
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch { return ''; }
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
    this.selectedProdutoIds.set([]);
    this.selectedProdutos.set([]);
    this.resetPromoForm();
  }

  novaPromocao() {
    this.resetEditor();
    this.showCreateModal.set(true);
  }

  editarPromocao(p: PromocaoDto) {
    if (!p.id) return;
    this.editingId.set(p.id);
    this.showCreateModal.set(true);
    this.api.getPromocao(p.id).subscribe((det: PromocaoDto) => {
      const produtosArr = (det.produtos ?? []).map((x: any) => ({
        id: Number(x.id),
        name: x.nome ?? x.name ?? '',
        price: Number(x.preco ?? x.price ?? 0)
      }));
      this.selectedProdutoIds.set(produtosArr.map(p => p.id));
      this.selectedProdutos.set(produtosArr);
      this.resetPromoForm(det);
    });
  }

  onProdutoIdsChange(ids: number[]) {
    this.selectedProdutoIds.set(Array.isArray(ids) ? ids.map(x => Number(x)) : []);
  }
  onProdutosChange(items: Array<{ id: number; name?: string; price?: number }> | undefined) {
    this.selectedProdutos.set(items || []);
  }

  submitPromo() {
    if (this.promoForm.invalid) { this.promoForm.markAllAsTouched(); return; }
    const values = this.promoForm.value;
    const body: PromocaoDto = {
      nome: values.nome,
      descricao: values.descricao || undefined,
      tipo: values.tipo || 'percentual',
      valor: Number(values.valor || 0),
      inicio: values.inicio || undefined,
      fim: values.fim || undefined,
      ativo: !!values.ativo
    } as any;

    const id = this.editingId();
    const productIds = this.selectedProdutoIds();
    this.submitting.set(true);

    const afterSave = (saved: PromocaoDto) => {
      const done = () => {
        this.submitting.set(false);
        this.closeCreateModal();
        this.loadList();
      };
      if (productIds.length) {
        this.api.setPromocaoProdutos(saved.id!, productIds).subscribe({ next: done, error: done });
      } else {
        done();
      }
    };

    if (id) this.api.updatePromocao(id, body).subscribe({ next: afterSave, error: () => this.submitting.set(false) });
    else this.api.createPromocao(body).subscribe({ next: afterSave, error: () => this.submitting.set(false) });
  }

  remover(p: PromocaoDto) {
    if (!p.id) return;
    if (confirm(`Remover promoção "${p.nome}"?`)) {
      this.api.deletePromocao(p.id).subscribe(() => this.loadList());
    }
  }

  removerEditando() {
    const id = this.editingId();
    if (!id) return;
    if (!confirm('Remover esta promoção?')) return;
    this.api.deletePromocao(id).subscribe(() => { this.closeCreateModal(); this.loadList(); });
  }

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
    this.showCreateModal.set(open);
    if (!open) this.resetEditor();
  }

  closeCreateModal() { this.resetEditor(); this.showCreateModal.set(false); }
}
