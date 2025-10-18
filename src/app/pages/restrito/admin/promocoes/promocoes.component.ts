import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminApiService, PromocaoDto, ProdutoDto } from '../../../../services/admin-api.service';

@Component({
  selector: 'app-admin-promocoes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './promocoes.component.html',
  styleUrls: ['./promocoes.component.scss']
})
export class AdminPromocoesComponent implements OnInit {
  fb = new FormBuilder();

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
  form: FormGroup = this.fb.group({
    nome: ['', Validators.required],
    descricao: [''],
    tipo: ['percentual'],
    valor: [0, [Validators.required]],
    inicio: [''],
    fim: [''],
    ativo: [true]
  });

  // seleção de produtos vinculados (IDs)
  produtosVinculados = signal<number[]>([]);
  // busca de produtos
  produtoBusca = new FormControl<string>('');
  produtoSugestoes = signal<Array<{ id: number; name: string; price?: number }>>([]);

  constructor(private api: AdminApiService) {}

  ngOnInit(): void {
    this.loadList();
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
    this.form.reset({ tipo: 'percentual', valor: 0, ativo: true });
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
      this.form.patchValue({
        nome: det.nome,
        descricao: det.descricao ?? '',
        tipo: det.tipo ?? 'percentual',
        valor: det.valor ?? 0,
        inicio: det.inicio ?? '',
        fim: det.fim ?? '',
        ativo: !!(det.ativo ?? true)
      });
      const ids = (det.produtos ?? []).map((x: any) => x.id);
      this.produtosVinculados.set(ids);
    });
  }

  salvar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const body: PromocaoDto = {
      nome: this.form.value.nome,
      descricao: this.form.value.descricao || undefined,
      tipo: this.form.value.tipo || 'percentual',
      valor: Number(this.form.value.valor || 0),
      inicio: this.form.value.inicio || undefined,
      fim: this.form.value.fim || undefined,
      ativo: !!this.form.value.ativo
    } as any;

    const id = this.editingId();
    const afterSave = (saved: PromocaoDto) => {
      const ids = this.produtosVinculados();
      if (ids.length) {
        this.api.setPromocaoProdutos(saved.id!, ids).subscribe(() => {
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

    if (id) {
      this.api.updatePromocao(id, body).subscribe(afterSave);
    } else {
      this.api.createPromocao(body).subscribe(afterSave);
    }
  }

  remover(p: PromocaoDto) {
    if (!p.id) return;
    if (confirm(`Remover promoção "${p.nome}"?`)) {
      this.api.deletePromocao(p.id).subscribe(() => this.loadList());
    }
  }

  // Produtos - busca e seleção
  buscarProdutos() {
    const q = (this.produtoBusca.value || '').trim();
    if (!q) { this.produtoSugestoes.set([]); return; }
    this.api.listProdutos({ q, page: 1, pageSize: 10, active: 1 }).subscribe(res => {
      const items = (res.data || []).map((p: ProdutoDto) => ({ id: Number(p.id), name: p.name, price: p.price }));
      this.produtoSugestoes.set(items);
    });
  }
  addProduto(id: number) {
    const set = new Set(this.produtosVinculados());
    set.add(id);
    this.produtosVinculados.set(Array.from(set));
  }
  removeProduto(id: number) {
    const list = this.produtosVinculados().filter(x => x !== id);
    this.produtosVinculados.set(list);
  }

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

  closeCreateModal(){ this.showCreateModal.set(false); }
}
