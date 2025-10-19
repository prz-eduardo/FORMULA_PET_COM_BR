import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AdminApiService, EstoqueAtivoDto, EstoqueMovimentoDto, UnitDto, FornecedorDto, InsumoDto } from '../../../../services/admin-api.service';
// removed reusable search import to use literal markup/logic

@Component({
  selector: 'app-admin-estoque',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './estoque.component.html',
  styleUrls: ['./estoque.component.scss']
})
export class EstoqueAdminComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(AdminApiService);
  // removido: ApiService público (não necessário com config consolidada)

  // form principal (criar lote)
  form = this.fb.group({
    id: [null as number | null],
    tipoSelecionado: ['ativo' as 'ativo' | 'insumo'],
    ativoBusca: [''],
    ativoSelecionado: [null as null | { id: number | string; nome?: string; ativo_nome?: string }],
    insumoBusca: [''],
    insumoSelecionado: [null as null | { id: number | string; nome: string }],
    quantity: [null as number | null, [Validators.required, Validators.min(0.000001)]],
    unit_code: ['', Validators.required],
    fornecedor_id: [null as number | null],
    nota_fiscal: [''],
    preco_unit: [null as number | null],
    lote: [''],
    validade: [''],
    location: [''],
    active: [1 as 0 | 1]
  });

  // state
  units: UnitDto[] = [];
  fornecedores: FornecedorDto[] = [];
  // Busca de ativo (igual produto)
  ativoQuery = signal('');
  ativosAll: Array<{ id: number | string; nome: string; descricao?: string }> = [];
  ativosSugestoes: Array<{ id: number|string; ativo_nome: string }> = [];
  ativoSelecionado: { id: number|string; ativo_nome: string } | null = null;
  insumoQuery = signal('');
  insumosAll: Array<{ id: number | string; nome: string; descricao?: string }> = [];
  insumosSugestoes: Array<{ id: number|string; nome: string }> = [];
  insumoSelecionado: { id: number|string; nome: string } | null = null;
  createdLote = signal<EstoqueAtivoDto | null>(null);
  lotes = signal<EstoqueAtivoDto[]>([]);
  movimentos = signal<EstoqueMovimentoDto[] | null>(null);
  error = signal<string | null>(null);
  saving = signal(false);
  // stepper simples
  step = signal(0); // 0: escolher ativo/listar lotes, 1: criar/editar lote

  // Gestão (tabela com filtros)
  filterForm = this.fb.group({
    q: [''],
    fornecedor_id: [null as number | null],
    active: ['all' as 'all' | '1' | '0'],
    onlySelectedAtivo: [false],
    onlySelectedInsumo: [false]
  });
  tablePage = signal(1);
  tablePageSize = signal(10);
  tableRows = signal<EstoqueAtivoDto[]>([]);
  tableTotal = signal(0);
  tableTotalPages = signal(0);
  tableLoading = signal(false);

  // helpers
  // getter removido; usamos a propriedade local ativoSelecionado
  get ativoBusca() { return this.form.value.ativoBusca || ''; }

  ngOnInit(): void {
    // carregar fornecedores
    this.api.listFornecedores().subscribe({ next: f => this.fornecedores = f || [], error: () => this.fornecedores = [] });
    // carregar config consolidada (units + ativos básicos + insumos)
    this.api.getConfigNewProduct().subscribe({
      next: (res) => {
        this.units = res.units || [];
        this.ativosAll = Array.isArray(res.ativos) ? res.ativos.map(a => ({ id: a.id, nome: a.nome })) : [];
        this.insumosAll = Array.isArray(res.insumos) ? res.insumos.map(i => ({ id: i.id, nome: i.nome })) : [];
      },
      error: () => { this.units = []; this.ativosAll = []; this.insumosAll = []; }
    });

    // carregar tabela inicial
    this.loadEstoqueTable(1);
  }

  private goHomeAndReload() {
    try {
      this.step.set(0);
      this.createdLote.set(null);
      this.movimentos.set(null);
    } catch {}
    // Força recarregar a rota atual para resetar todo o estado
    try { window.location.reload(); } catch { /* noop */ }
  }

  // Busca de ativo - igual produto
  onAtivoQueryChange(q: string) {
    this.ativoQuery.set(q);
    const term = (q || '').trim();
    if (!term) { this.ativosSugestoes = []; this.ativoSelecionado = null; this.form.patchValue({ ativoSelecionado: null }); return; }
    const lower = term.toLowerCase();
    this.ativosSugestoes = (this.ativosAll || [])
      .filter(a => (a.nome || '').toLowerCase().includes(lower) || ((a as any).descricao || '').toLowerCase().includes(lower))
      .slice(0, 20)
      .map(a => ({ id: a.id as any, ativo_nome: (a as any).nome }));
  }
  selecionarAtivo(op: { id: number|string; ativo_nome: string }) {
    this.ativoSelecionado = op;
    this.form.patchValue({ ativoSelecionado: op });
    this.ativosSugestoes = [];
    // carregar lotes existentes para o ativo
    this.loadLotesByAtivo(op.id);
    // opcional: se filtro estiver marcado para usar ativo selecionado, recarrega tabela
    if (this.filterForm.value.onlySelectedAtivo) this.loadEstoqueTable(1);
  }

  onInsumoQueryChange(q: string) {
    this.insumoQuery.set(q);
    const term = (q || '').trim();
    if (!term) { this.insumosSugestoes = []; this.insumoSelecionado = null; this.form.patchValue({ insumoSelecionado: null }); return; }
    const lower = term.toLowerCase();
    this.insumosSugestoes = (this.insumosAll || [])
      .filter(i => (i.nome || '').toLowerCase().includes(lower) || ((i as any).descricao || '').toLowerCase().includes(lower))
      .slice(0, 20)
      .map(i => ({ id: i.id as any, nome: (i as any).nome }));
  }
  selecionarInsumo(op: { id: number|string; nome: string }) {
    this.insumoSelecionado = op;
    this.form.patchValue({ insumoSelecionado: op });
    this.insumosSugestoes = [];
    // carregar lotes existentes para o insumo
    this.loadLotesByInsumo(op.id);
    if (this.filterForm.value.onlySelectedInsumo) this.loadEstoqueTable(1);
  }

  async criarLote() {
    this.error.set(null);
    const tipo = this.form.value.tipoSelecionado;
    const isAtivo = tipo === 'ativo';
    const isInsumo = tipo === 'insumo';
    const ativoSel = this.form.value.ativoSelecionado;
    const insumoSel = this.form.value.insumoSelecionado;
    if (this.form.invalid || (isAtivo && !ativoSel) || (isInsumo && !insumoSel)) {
      this.error.set(isInsumo ? 'Preencha insumo, quantidade e unidade.' : 'Preencha ativo, quantidade e unidade.');
      return;
    }
    this.saving.set(true);
    const { quantity, unit_code, lote, validade, location, fornecedor_id, nota_fiscal, preco_unit } = this.form.value;
    this.api.createEstoque({
      ativo_id: isAtivo ? Number(ativoSel!.id) : undefined,
      insumo_id: isInsumo ? Number(insumoSel!.id) : undefined,
      quantity: Number(quantity),
      unit_code: String(unit_code),
      fornecedor_id: fornecedor_id != null ? Number(fornecedor_id) : undefined,
      nota_fiscal: nota_fiscal || undefined,
      preco_unit: preco_unit != null ? Number(preco_unit) : undefined,
      lote: lote || undefined,
      validade: validade || undefined,
      location: location || undefined
    }).subscribe({
      next: (res) => {
        this.createdLote.set(res);
        this.form.patchValue({ id: res.id, active: (res.active as any) ?? 1 });
        this.saving.set(false);
        // Após salvar, voltar e recarregar a tela para garantir estado dinâmico
        this.goHomeAndReload();
      },
      error: (e) => { console.error(e); this.error.set('Não foi possível criar o lote.'); this.saving.set(false); }
    });
  }

  // Selecionar lote existente para edição
  selecionarLoteExistente(l: EstoqueAtivoDto) {
    this.createdLote.set(l);
    // garantir que o nome do ativo apareça no cabeçalho do formulário ao editar via tabela
    if (!this.ativoSelecionado) {
      const nome = l.ativo_nome || (this.ativosAll.find(a => String(a.id) === String(l.ativo_id))?.nome) || `Ativo ${l.ativo_id}`;
      this.ativoSelecionado = { id: l.ativo_id, ativo_nome: nome } as any;
    }
    // preencher formulário para edição
    this.form.patchValue({
      id: l.id,
      ativoSelecionado: this.ativoSelecionado,
      quantity: l.quantity,
      unit_code: l.unit_code,
      fornecedor_id: (l.fornecedor_id as any) ?? null,
      nota_fiscal: l.nota_fiscal || '',
      preco_unit: (l.preco_unit as any) ?? null,
      lote: l.lote || '',
      validade: l.validade || '',
      location: l.location || '',
      active: (l.active as any) ?? 1,
    });
    // carregar movimentos
    this.api.movimentosEstoque(l.id).subscribe({ next: mv => this.movimentos.set(mv), error: () => this.movimentos.set([]) });
    // atualizar listagem de lotes visível (caso tenha vindo da tabela)
    this.loadLotesByAtivo(l.ativo_id);
    // pular para etapa de edição
    this.step.set(1);
  }

  salvarAlteracoes() {
    this.error.set(null);
    const id = this.form.value.id;
    if (!id) { this.error.set('Nenhum lote selecionado para edição.'); return; }
    this.saving.set(true);
    const { quantity, unit_code, lote, validade, location, fornecedor_id, nota_fiscal, preco_unit, active } = this.form.value;
    const body: any = {
      // quantity é opcional; preferir usar Entrada/Ajuste/Consumo para mudar estoque
      quantity: quantity != null ? Number(quantity) : undefined,
      unit_code: unit_code || undefined,
      lote: lote || undefined,
      validade: validade || undefined,
      location: location || undefined,
      fornecedor_id: fornecedor_id != null ? Number(fornecedor_id) : undefined,
      nota_fiscal: nota_fiscal || undefined,
      preco_unit: preco_unit != null ? Number(preco_unit) : undefined,
      active: typeof active === 'number' ? active : (active ? 1 : 0)
    };
    this.api.updateEstoque(id, body).subscribe({
      next: (res) => {
        this.createdLote.set(res);
        this.saving.set(false);
        // Após terminar de editar, voltar e recarregar a tela
        this.goHomeAndReload();
      },
      error: (e) => { console.error(e); this.error.set('Falha ao salvar alterações do lote.'); this.saving.set(false); }
    });
  }

  // Ações pós-criação
  entrada(qtd: number, unit: string, reason?: string) {
    const lote = this.createdLote();
    if (!lote) return;
    const fornecedorId = this.form.value.fornecedor_id != null ? Number(this.form.value.fornecedor_id) : undefined;
    const precoUnit = this.form.value.preco_unit != null ? Number(this.form.value.preco_unit) : undefined;
    this.api.entradaEstoque(lote.id, { quantity: qtd, unit_code: unit, reason, fornecedor_id: fornecedorId, preco_unit: precoUnit }).subscribe({
      next: () => this.refreshLote(lote.id),
      error: () => this.error.set('Falha ao registrar entrada')
    });
  }

  ajuste(qtd: number, unit: string, reason?: string) {
    const lote = this.createdLote();
    if (!lote) return;
    this.api.ajusteEstoque(lote.id, { quantity: qtd, unit_code: unit, reason }).subscribe({
      next: () => this.refreshLote(lote.id),
      error: () => this.error.set('Falha ao ajustar estoque')
    });
  }

  consumir(qtd: number, unit: string, reason?: string) {
    const lote = this.createdLote();
    if (!lote) return;
    this.api.consumirEstoque(lote.id, { quantity: qtd, unit_code: unit, reason }).subscribe({
      next: () => this.refreshLote(lote.id),
      error: () => this.error.set('Falha ao consumir estoque')
    });
  }

  deletarLote() {
    const lote = this.createdLote();
    if (!lote) return;
    if (!confirm('Deseja realmente deletar este lote?')) return;
    this.api.deleteEstoque(lote.id).subscribe({
      next: () => {
        this.createdLote.set(null); this.movimentos.set(null);
        // atualizar listagem e voltar para etapa 0
        if (this.ativoSelecionado) this.loadLotesByAtivo(this.ativoSelecionado.id);
        this.step.set(0);
        this.reloadTable();
      },
      error: () => this.error.set('Falha ao deletar lote')
    });
  }

  private refreshLote(id: number) {
    this.api.getEstoque(id).subscribe({ next: l => this.createdLote.set(l), error: () => {} });
    this.api.movimentosEstoque(id).subscribe({ next: mv => this.movimentos.set(mv), error: () => this.movimentos.set([]) });
  }

  // Template helpers
  toNumber(v: any): number { return v === '' || v == null ? 0 : Number(v); }

  humanizeValidade(v?: string | null): string {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    const today = new Date();
    // normalize to local midnight for day diff
    const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
    const dd = startOf(d).getTime();
    const td = startOf(today).getTime();
    const diffDays = Math.round((dd - td) / 86400000);
    const fmt = new Intl.DateTimeFormat('pt-BR').format(d);
    if (diffDays === 0) return `${fmt} (hoje)`;
    if (diffDays > 0) return `${fmt} (em ${diffDays} dia${diffDays === 1 ? '' : 's'})`;
    const abs = Math.abs(diffDays);
    return `${fmt} (vencido há ${abs} dia${abs === 1 ? '' : 's'})`;
  }

  isVencido(v?: string | null): boolean {
    if (!v) return false;
    const d = new Date(v);
    if (isNaN(d.getTime())) return false;
    const today = new Date();
    const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
    return startOf(d).getTime() < startOf(today).getTime();
  }

  isEmBreve(v?: string | null, dias: number = 30): boolean {
    if (!v) return false;
    const d = new Date(v);
    if (isNaN(d.getTime())) return false;
    const today = new Date();
    const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
    const diffDays = Math.round((startOf(d).getTime() - startOf(today).getTime()) / 86400000);
    return diffDays >= 0 && diffDays <= dias;
  }

  // carregar lotes por ativo
  private loadLotesByAtivo(ativoId: number | string) {
    this.api.listEstoque({ ativo_id: ativoId, page: 1, pageSize: 100, active: 1 }).subscribe({
      next: (res) => this.lotes.set(res.data || []),
      error: () => this.lotes.set([])
    });
  }

  // carregar lotes por insumo
  private loadLotesByInsumo(insumoId: number | string) {
    this.api.listEstoque({ insumo_id: insumoId, page: 1, pageSize: 100, active: 1 }).subscribe({
      next: (res) => this.lotes.set(res.data || []),
      error: () => this.lotes.set([])
    });
  }

  // Gestão: carregar e filtrar tabela principal
  loadEstoqueTable(page?: number) {
    if (page) this.tablePage.set(page);
    const p = this.tablePage();
    const ps = this.tablePageSize();
    const f = this.filterForm.value;
    const params: any = { page: p, pageSize: ps };
    if (f.q && f.q.trim()) params.q = f.q.trim();
    if (f.fornecedor_id != null) params.fornecedor_id = Number(f.fornecedor_id);
    if (f.active === '1') params.active = 1; else if (f.active === '0') params.active = 0;
  if (f.onlySelectedAtivo && this.ativoSelecionado) params.ativo_id = this.ativoSelecionado.id;
  if ((this.filterForm.value as any).onlySelectedInsumo && this.insumoSelecionado) params.insumo_id = this.insumoSelecionado.id;
    this.tableLoading.set(true);
    this.api.listEstoque(params).subscribe({
      next: (res) => {
        this.tableRows.set(res.data || []);
        this.tableTotal.set(res.total || 0);
        this.tableTotalPages.set(res.totalPages || 0);
        this.tableLoading.set(false);
      },
      error: () => { this.tableRows.set([]); this.tableTotal.set(0); this.tableTotalPages.set(0); this.tableLoading.set(false); }
    });
  }
  onFilterChange() { this.loadEstoqueTable(1); }
  changeTablePage(delta: number) {
    const next = Math.max(1, Math.min((this.tableTotalPages() || 1), this.tablePage() + delta));
    if (next !== this.tablePage()) this.loadEstoqueTable(next);
  }
  reloadTable() { this.loadEstoqueTable(this.tablePage()); }

  // Ações rápidas na tabela
  editarRow(l: EstoqueAtivoDto) { this.selecionarLoteExistente(l); }
  deletarRow(l: EstoqueAtivoDto) {
    if (!confirm('Deseja realmente deletar este lote?')) return;
    this.api.deleteEstoque(l.id).subscribe({ next: () => { this.reloadTable(); if (this.ativoSelecionado) this.loadLotesByAtivo(this.ativoSelecionado.id); }, error: () => this.error.set('Falha ao deletar lote') });
  }
  toggleAtivoRow(l: EstoqueAtivoDto) {
    const newActive = (l.active as any) ? 0 : 1;
    this.api.updateEstoque(l.id, { active: newActive }).subscribe({ next: () => this.reloadTable(), error: () => this.error.set('Falha ao atualizar status') });
  }

  // navegação stepper
  goToStep(i: number) {
    if (i < 0 || i > 1) return;
    // só deixa ir pra etapa 1 se tiver ativo/insumo selecionado
    const tipo = this.form.value.tipoSelecionado;
    if (i === 1 && ((tipo === 'ativo' && !this.ativoSelecionado) || (tipo === 'insumo' && !this.insumoSelecionado))) return;
    this.step.set(i);
  }
  nextStep() { this.goToStep(this.step() + 1); }
  prevStep() { this.goToStep(this.step() - 1); }
}
