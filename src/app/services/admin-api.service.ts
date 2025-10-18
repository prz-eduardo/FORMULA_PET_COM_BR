import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../enviroments/environment';
import { SessionService } from './session.service';

export type TaxonomyType = 'categorias' | 'tags' | 'dosages' | 'embalagens';

export interface ProdutoDto {
  id?: string | number;
  name: string;
  description: string;
  price: number;
  image?: string | null;
  category: string;
  customizations: { dosage: string[]; packaging: string[] };
  discount?: number | null;
  rating?: number | null;
  stock?: number | null;
  tags: string[];
  weightValue?: number | null;
  weightUnit?: string | null;
  // Associação opcional com um ativo (pode ser null ou ausente)
  ativoId?: string | number | null;
  // Se vinculado a um ativo, a associação deve ser feita a um lote do estoque
  estoqueId?: string | number | null;
  // Forma farmacêutica opcional
  formId?: number | null;
  active?: number; // 1 ativo, 0 inativo
  created_at?: string;
  updated_at?: string;
}

// Tipos auxiliares para novo modelo
export interface UnitDto {
  code: string;
  name: string;
  kind: 'mass' | 'volume' | 'count' | 'other';
  factor_to_base: number;
}

export interface ProductFormDto { id: number; name: string }

export interface EstoqueAtivoDto {
  id: number;
  ativo_id: number;
  quantity: number;
  unit_code: string;
  lote?: string | null;
  validade?: string | null;
  location?: string | null;
  active?: number;
  created_at?: string;
  // Enriquecimentos
  ativo_nome?: string;
  unit_name?: string;
  kind?: 'mass' | 'volume' | 'count' | 'other';
  fornecedor_id?: number | null;
  fornecedor_nome?: string | null;
  nota_fiscal?: string | null;
  preco_unit?: number | null;
  preco_por_kg?: number | null;
}

export interface EstoqueMovimentoDto {
  id: number;
  ativo_id: number;
  estoque_id: number | null;
  tipo: 'entrada' | 'saida' | 'ajuste';
  quantity: number;
  unit_code: string;
  reason?: string | null;
  created_at: string;
  fornecedor_id?: number | null;
  fornecedor_nome?: string | null;
  preco_unit?: number | null;
  preco_por_kg?: number | null;
}

export interface Paged<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// Pessoas (Usuários/Clientes/Vets)
export interface PessoaDto {
  id: number | string;
  uid?: string;
  // Unificado: backend usa 'nome', manter alias 'name' para front
  name?: string | null;
  nome?: string | null;
  email?: string | null;
  phone?: string | null;
  telefone?: string | null;
  city?: string | null;
  uf?: string | null;
  cpf?: string | null;
  role?: 'cliente' | 'vet' | 'admin';
  tipo?: 'cliente' | 'vet' | 'admin';
  active?: 0 | 1;
  ativo?: 0 | 1;
  created_at?: string;
  updated_at?: string;
  // Vet extras
  crmv?: string | null;
  verification_status?: 'pending' | 'approved' | 'rejected' | null;
  approved?: 0 | 1;
}
export interface PessoaDocDto {
  id: number | string;
  tipo: 'rg' | 'cpf' | 'crmv' | 'comprovante' | 'outro';
  url: string;
  mime_type?: string | null;
  uploaded_at?: string;
}

export interface FornecedorDto { id: number; nome: string }
export interface AdminFornecedorDto {
  id?: number;
  nome: string;
  cnpj?: string | null;
  contato?: string | null;
  email?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  obs?: string | null;
  ativo?: 0 | 1;
  created_at?: string;
  updated_at?: string;
}

// Fórmulas (manipulados)
export interface FormulaDto {
  id?: number;
  name: string;
  form_id: number;
  output_unit_code: string;
  dose_amount?: number | null;
  dose_unit_code?: string | null;
  output_quantity_per_batch?: number | null;
  price?: number | null;
  notes?: string | null;
  active?: boolean | number;
  created_at?: string;
  updated_at?: string;
}

export type FormulaItemTipo = 'ativo' | 'insumo';
export interface FormulaItemDto {
  tipo: FormulaItemTipo;
  ativo_id?: number; // quando tipo = 'ativo'
  insumo_nome?: string; // quando tipo = 'insumo'
  quantity: number;
  unit_code: string;
}

// Marketplace Customizações
export interface MarketplaceCategoria { id?: number; nome: string; slug?: string | null; icone?: string | null }
export interface MarketplaceTag { id?: number; nome: string }
export interface MarketplaceCustomizacoesPayload {
  categorias?: Array<{ id?: number; nome?: string; slug?: string; icone?: string; delete?: boolean; remover?: boolean }>;
  tags?: Array<{ id?: number; nome?: string; delete?: boolean; remover?: boolean }>;
}
export interface MarketplaceCustomizacoesResponse {
  ok: boolean;
  changes: {
    created: { categorias: number[]; tags: number[] };
    updated: { categorias: number[]; tags: number[] };
    deleted: { categorias: number[]; tags: number[] };
  };
  categorias: MarketplaceCategoria[];
  tags: MarketplaceTag[];
}
export interface MarketplaceCustomizacoesList { categorias: MarketplaceCategoria[]; tags: MarketplaceTag[] }

// Promoções
export type PromocaoTipo = 'percentual' | 'valor';
export interface PromocaoDto {
  id?: number;
  nome: string;
  descricao?: string | null;
  tipo?: PromocaoTipo;
  valor?: number;
  inicio?: string | null; // YYYY-MM-DD HH:mm:ss ou YYYY-MM-DDTHH:mm:ss
  fim?: string | null;
  ativo?: boolean | number;
  created_at?: string;
  updated_at?: string;
  produtos?: Array<{ id: number; name: string; price?: number }>; // resumo
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private baseUrl = `${environment.apiBaseUrl}/admin`;
  private dashboardUrl = `${environment.apiBaseUrl}/dashboard`;

  constructor(private http: HttpClient, private session: SessionService) {}

  private headers(): HttpHeaders {
    const token = this.session.getBackendToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // Configuração para novo cadastro de produto (formas, unidades, ativos)
  getConfigNewProduct(params?: { q?: string }): Observable<{ forms: ProductFormDto[]; units: UnitDto[]; ativos: Array<{ id: number; nome: string }> }> {
    let httpParams = new HttpParams();
    if (params?.q) httpParams = httpParams.set('q', params.q);
    return this.http.get<{ forms: ProductFormDto[]; units: UnitDto[]; ativos: Array<{ id: number; nome: string }> }>(
      `${this.baseUrl}/config-new-product`,
      { headers: this.headers(), params: httpParams }
    );
  }

  // Produtos
  listProdutos(params?: { q?: string; page?: number; pageSize?: number; category?: string; tag?: string; ativoId?: string | number; active?: 0 | 1; ativo_nome?: string }): Observable<Paged<ProdutoDto>> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.q) httpParams = httpParams.set('q', params.q);
      if (params.page) httpParams = httpParams.set('page', String(params.page));
      if (params.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
      if (params.category) httpParams = httpParams.set('category', params.category);
      if (params.tag) httpParams = httpParams.set('tag', params.tag);
      if (params.ativoId != null) httpParams = httpParams.set('ativoId', String(params.ativoId));
      if (params.ativo_nome) httpParams = httpParams.set('ativo_nome', params.ativo_nome);
      if (typeof params.active === 'number') httpParams = httpParams.set('active', String(params.active));
    }
    return this.http.get<Paged<ProdutoDto>>(`${this.baseUrl}/produtos`, { headers: this.headers(), params: httpParams });
  }

  getProduto(id: string | number): Observable<ProdutoDto> {
    return this.http.get<ProdutoDto>(`${this.baseUrl}/produtos/${id}`, { headers: this.headers() });
  }

  createProduto(body: ProdutoDto): Observable<ProdutoDto> {
    return this.http.post<ProdutoDto>(`${this.baseUrl}/produtos`, body, { headers: this.headers() });
  }

  updateProduto(id: string | number, body: Partial<ProdutoDto>): Observable<ProdutoDto> {
    return this.http.put<ProdutoDto>(`${this.baseUrl}/produtos/${id}`, body, { headers: this.headers() });
  }

  deleteProduto(id: string | number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/produtos/${id}`, { headers: this.headers() });
  }

  // Upload de imagem (opcional)
  uploadProdutoImagem(id: string | number, file: File): Observable<{ imageUrl: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ imageUrl: string }>(`${this.baseUrl}/produtos/${id}/imagem`, form, { headers: this.headers() });
  }

  reativarProduto(id: string | number): Observable<ProdutoDto> {
    return this.http.post<ProdutoDto>(`${this.baseUrl}/produtos/${id}/reativar`, {}, { headers: this.headers() });
  }

  produtosPorAtivo(ativoId: string | number): Observable<ProdutoDto[]> {
    return this.http.get<ProdutoDto[]>(`${this.baseUrl}/produtos-por-ativo/${ativoId}`, { headers: this.headers() });
  }

  produtosMeta(): Observable<{ categorias: Array<{id: string|number; name: string}>; tags: Array<{id: string|number; name: string}>; dosages: Array<{id: string|number; name: string}>; embalagens: Array<{id: string|number; name: string}>; }>{
    return this.http.get<{ categorias: Array<{id: string|number; name: string}>; tags: Array<{id: string|number; name: string}>; dosages: Array<{id: string|number; name: string}>; embalagens: Array<{id: string|number; name: string}>; }>(`${this.baseUrl}/produtos-meta`, { headers: this.headers() });
  }

  // Taxonomias
  listTaxonomia(tipo: TaxonomyType): Observable<{ data: Array<{ id: string | number; name: string }> }> {
    return this.http.get<{ data: Array<{ id: string | number; name: string }> }>(`${this.baseUrl}/taxonomias/${tipo}`, { headers: this.headers() });
  }

  createTaxonomia(tipo: TaxonomyType, name: string): Observable<{ id: string | number; name: string }> {
    return this.http.post<{ id: string | number; name: string }>(`${this.baseUrl}/taxonomias/${tipo}`, { name }, { headers: this.headers() });
  }

  updateTaxonomia(tipo: TaxonomyType, id: string | number, name: string): Observable<{ id: string | number; name: string }> {
    return this.http.put<{ id: string | number; name: string }>(`${this.baseUrl}/taxonomias/${tipo}/${id}`, { name }, { headers: this.headers() });
  }

  deleteTaxonomia(tipo: TaxonomyType, id: string | number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/taxonomias/${tipo}/${id}`, { headers: this.headers() });
  }

  // Ativos
  listAtivos(params?: { q?: string; page?: number; pageSize?: number }): Observable<Paged<any>> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.q) httpParams = httpParams.set('q', params.q);
      if (params.page) httpParams = httpParams.set('page', String(params.page));
      if (params.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
    }
    return this.http.get<Paged<any>>(`${this.baseUrl}/ativos`, { headers: this.headers(), params: httpParams });
  }

  getAtivo(id: string | number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/ativos/${id}`, { headers: this.headers() });
    }

  createAtivo(body: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/ativos`, body, { headers: this.headers() });
  }

  updateAtivo(id: string | number, body: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/ativos/${id}`, body, { headers: this.headers() });
  }

  deleteAtivo(id: string | number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/ativos/${id}`, { headers: this.headers() });
  }

  scrapForVets(): Observable<{ imported: number }> {
    return this.http.post<{ imported: number }>(`${this.baseUrl}/ativos/scrap-forvets`, {}, { headers: this.headers() });
  }

  // Estoque de ativos (lotes)
  listEstoque(params?: { ativo_id?: string | number; q?: string; fornecedor_id?: string | number; page?: number; pageSize?: number; active?: 0 | 1 }): Observable<Paged<EstoqueAtivoDto>> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.ativo_id != null) httpParams = httpParams.set('ativo_id', String(params.ativo_id));
      if (params.q) httpParams = httpParams.set('q', params.q);
      if (params.fornecedor_id != null) httpParams = httpParams.set('fornecedor_id', String(params.fornecedor_id));
      if (params.page) httpParams = httpParams.set('page', String(params.page));
      if (params.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
      if (typeof params.active === 'number') httpParams = httpParams.set('active', String(params.active));
    }
    return this.http.get<Paged<EstoqueAtivoDto>>(`${this.baseUrl}/estoque`, { headers: this.headers(), params: httpParams });
  }

  getEstoque(id: string | number): Observable<EstoqueAtivoDto> {
    return this.http.get<EstoqueAtivoDto>(`${this.baseUrl}/estoque/${id}`, { headers: this.headers() });
  }

  createEstoque(body: { ativo_id: number | string; quantity: number; unit_code: string; lote?: string; validade?: string; location?: string; fornecedor_id?: number | string; nota_fiscal?: string; preco_unit?: number }): Observable<EstoqueAtivoDto> {
    return this.http.post<EstoqueAtivoDto>(`${this.baseUrl}/estoque`, body, { headers: this.headers() });
  }

  updateEstoque(id: string | number, body: Partial<{ ativo_id: number | string; quantity: number; unit_code: string; lote?: string; validade?: string; location?: string; active?: 0 | 1; fornecedor_id?: number | string; nota_fiscal?: string; preco_unit?: number }>): Observable<EstoqueAtivoDto> {
    return this.http.put<EstoqueAtivoDto>(`${this.baseUrl}/estoque/${id}`, body, { headers: this.headers() });
  }

  consumirEstoque(id: string | number, body: { quantity: number; unit_code: string; reason?: string }): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.baseUrl}/estoque/${id}/consumir`, body, { headers: this.headers() });
  }

  entradaEstoque(id: string | number, body: { quantity: number; unit_code: string; reason?: string; fornecedor_id?: number | string; preco_unit?: number }): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.baseUrl}/estoque/${id}/entrada`, body, { headers: this.headers() });
  }

  ajusteEstoque(id: string | number, body: { quantity: number; unit_code: string; reason?: string }): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.baseUrl}/estoque/${id}/ajuste`, body, { headers: this.headers() });
  }

  deleteEstoque(id: string | number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/estoque/${id}`, { headers: this.headers() });
  }

  movimentosEstoque(id: string | number): Observable<EstoqueMovimentoDto[]> {
    return this.http.get<EstoqueMovimentoDto[]>(`${this.baseUrl}/estoque/${id}/movimentos`, { headers: this.headers() });
  }

  // Units (opcional, além do config)
  listUnits(): Observable<UnitDto[]> {
    return this.http.get<UnitDto[]>(`${this.baseUrl}/units`, { headers: this.headers() });
  }

  // Fornecedores (lista para selects)
  listFornecedores(): Observable<FornecedorDto[]> {
    return this.http.get<any>(`${this.baseUrl}/fornecedores`, { headers: this.headers() })
      .pipe(map((res) => Array.isArray(res) ? res : (res?.data ?? [])));
  }

  // Admin - Fornecedores CRUD (/admin/fornecedores)
  listAdminFornecedores(params?: { q?: string; active?: 0 | 1; page?: number; pageSize?: number }): Observable<Paged<AdminFornecedorDto>> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.q) httpParams = httpParams.set('q', params.q);
      if (typeof params.active === 'number') httpParams = httpParams.set('active', String(params.active));
      if (params.page) httpParams = httpParams.set('page', String(params.page));
      if (params.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
    }
    return this.http.get<Paged<AdminFornecedorDto>>(`${this.baseUrl}/fornecedores`, { headers: this.headers(), params: httpParams });
  }
  getAdminFornecedor(id: number | string): Observable<AdminFornecedorDto> {
    return this.http.get<AdminFornecedorDto>(`${this.baseUrl}/fornecedores/${id}`, { headers: this.headers() });
  }
  createAdminFornecedor(body: Partial<AdminFornecedorDto> & { nome: string }): Observable<AdminFornecedorDto> {
    return this.http.post<AdminFornecedorDto>(`${this.baseUrl}/fornecedores`, body, { headers: this.headers() });
  }
  updateAdminFornecedor(id: number | string, body: Partial<AdminFornecedorDto>): Observable<AdminFornecedorDto> {
    return this.http.put<AdminFornecedorDto>(`${this.baseUrl}/fornecedores/${id}`, body, { headers: this.headers() });
  }
  deleteAdminFornecedor(id: number | string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/fornecedores/${id}`, { headers: this.headers() });
  }

  // Dashboard
  getDashboard(): Observable<any> {
    return this.http.get<any>(this.dashboardUrl, { headers: this.headers() });
  }

  // Modular Admin Dashboard endpoints
  getAdminDashboardSummary(params?: { from?: string; to?: string; sortDir?: 'asc'|'desc'; limit?: number }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.from) httpParams = httpParams.set('from', params.from);
      if (params.to) httpParams = httpParams.set('to', params.to);
      if (params.sortDir) httpParams = httpParams.set('sortDir', params.sortDir);
      if (params.limit != null) httpParams = httpParams.set('limit', String(params.limit));
    }
    return this.http.get<any>(`${this.baseUrl}/dashboard/summary`, { headers: this.headers(), params: httpParams });
  }
  getAdminDashboardSales(params?: { from?: string; to?: string; sortDir?: 'asc'|'desc'; limit?: number }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.from) httpParams = httpParams.set('from', params.from);
      if (params.to) httpParams = httpParams.set('to', params.to);
      if (params.sortDir) httpParams = httpParams.set('sortDir', params.sortDir);
      if (params.limit != null) httpParams = httpParams.set('limit', String(params.limit));
    }
    return this.http.get<any>(`${this.baseUrl}/dashboard/sales`, { headers: this.headers(), params: httpParams });
  }
  getAdminDashboardMarketplace(params?: { from?: string; to?: string; sortDir?: 'asc'|'desc'; limit?: number }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.from) httpParams = httpParams.set('from', params.from);
      if (params.to) httpParams = httpParams.set('to', params.to);
      if (params.sortDir) httpParams = httpParams.set('sortDir', params.sortDir);
      if (params.limit != null) httpParams = httpParams.set('limit', String(params.limit));
    }
    return this.http.get<any>(`${this.baseUrl}/dashboard/marketplace`, { headers: this.headers(), params: httpParams });
  }
  getAdminDashboardCustomers(params?: { from?: string; to?: string; sortDir?: 'asc'|'desc'; limit?: number }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.from) httpParams = httpParams.set('from', params.from);
      if (params.to) httpParams = httpParams.set('to', params.to);
      if (params.sortDir) httpParams = httpParams.set('sortDir', params.sortDir);
      if (params.limit != null) httpParams = httpParams.set('limit', String(params.limit));
    }
    return this.http.get<any>(`${this.baseUrl}/dashboard/customers`, { headers: this.headers(), params: httpParams });
  }
  getAdminDashboardPromotions(params?: { from?: string; to?: string; sortDir?: 'asc'|'desc'; limit?: number }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.from) httpParams = httpParams.set('from', params.from);
      if (params.to) httpParams = httpParams.set('to', params.to);
      if (params.sortDir) httpParams = httpParams.set('sortDir', params.sortDir);
      if (params.limit != null) httpParams = httpParams.set('limit', String(params.limit));
    }
    return this.http.get<any>(`${this.baseUrl}/dashboard/promotions`, { headers: this.headers(), params: httpParams });
  }
  getAdminDashboardCoupons(params?: { from?: string; to?: string; sortDir?: 'asc'|'desc'; limit?: number }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.from) httpParams = httpParams.set('from', params.from);
      if (params.to) httpParams = httpParams.set('to', params.to);
      if (params.sortDir) httpParams = httpParams.set('sortDir', params.sortDir);
      if (params.limit != null) httpParams = httpParams.set('limit', String(params.limit));
    }
    return this.http.get<any>(`${this.baseUrl}/dashboard/coupons`, { headers: this.headers(), params: httpParams });
  }

  // Fórmulas - cadastro
  createFormula(body: FormulaDto): Observable<FormulaDto> {
    return this.http.post<FormulaDto>(`${this.baseUrl}/formulas`, body, { headers: this.headers() });
  }
  getFormula(id: number | string): Observable<FormulaDto & { items?: FormulaItemDto[] }> {
    return this.http.get<FormulaDto & { items?: FormulaItemDto[] }>(`${this.baseUrl}/formulas/${id}`, { headers: this.headers() });
  }
  updateFormula(id: number | string, body: Partial<FormulaDto>): Observable<FormulaDto> {
    return this.http.put<FormulaDto>(`${this.baseUrl}/formulas/${id}`, body, { headers: this.headers() });
  }
  updateFormulaItems(id: number | string, items: FormulaItemDto[]): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${this.baseUrl}/formulas/${id}/itens`, { items }, { headers: this.headers() });
  }
  estimateFormula(id: number | string): Observable<{ producible_units: number; limiting?: any }> {
    return this.http.get<{ producible_units: number; limiting?: any }>(`${this.baseUrl}/formulas/${id}/estimate`, { headers: this.headers() });
  }
  listFormulas(params?: { includeEstimates?: 0 | 1; q?: string; page?: number; pageSize?: number }): Observable<Paged<FormulaDto & { estimate?: { producible_units: number; limiting?: any } }>> {
    let httpParams = new HttpParams();
    if (params) {
      if (typeof params.includeEstimates === 'number') httpParams = httpParams.set('includeEstimates', String(params.includeEstimates));
      if (params.q) httpParams = httpParams.set('q', params.q);
      if (params.page) httpParams = httpParams.set('page', String(params.page));
      if (params.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
    }
    return this.http.get<Paged<FormulaDto & { estimate?: { producible_units: number; limiting?: any } }>>(`${this.baseUrl}/formulas`, { headers: this.headers(), params: httpParams });
  }
  // Marketplace - criação full referenciando fórmula
  createMarketplaceProdutoFull(body: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/marketplace/produtos/full`, body, { headers: this.headers() });
  }
  // Marketplace - customizações (categorias e tags)
  manageMarketplaceCustomizacoes(body: MarketplaceCustomizacoesPayload): Observable<MarketplaceCustomizacoesResponse> {
    return this.http.post<MarketplaceCustomizacoesResponse>(`${this.baseUrl}/marketplace/customizacoes`, body, { headers: this.headers() });
  }
  getMarketplaceCustomizacoes(): Observable<MarketplaceCustomizacoesList> {
    return this.http.get<MarketplaceCustomizacoesList>(`${this.baseUrl}/marketplace/customizacoes`, { headers: this.headers() });
  }

  // Admin - Promoções
  listPromocoes(params?: { q?: string; page?: number; pageSize?: number; active?: 0 | 1 }): Observable<Paged<PromocaoDto>> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.q) httpParams = httpParams.set('q', params.q);
      if (params.page) httpParams = httpParams.set('page', String(params.page));
      if (params.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
      if (typeof params.active === 'number') httpParams = httpParams.set('active', String(params.active));
    }
    return this.http.get<Paged<PromocaoDto>>(`${this.baseUrl}/promocoes`, { headers: this.headers(), params: httpParams });
  }
  getPromocao(id: number | string): Observable<PromocaoDto> {
    return this.http.get<PromocaoDto>(`${this.baseUrl}/promocoes/${id}`, { headers: this.headers() });
  }
  createPromocao(body: PromocaoDto): Observable<PromocaoDto> {
    return this.http.post<PromocaoDto>(`${this.baseUrl}/promocoes`, body, { headers: this.headers() });
  }
  updatePromocao(id: number | string, body: Partial<PromocaoDto>): Observable<PromocaoDto> {
    return this.http.put<PromocaoDto>(`${this.baseUrl}/promocoes/${id}`, body, { headers: this.headers() });
  }
  deletePromocao(id: number | string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/promocoes/${id}`, { headers: this.headers() });
  }
  setPromocaoProdutos(id: number | string, produto_ids: number[]): Observable<PromocaoDto> {
    return this.http.put<PromocaoDto>(`${this.baseUrl}/promocoes/${id}/produtos`, { produto_ids }, { headers: this.headers() });
  }

  // Usuários
  listUsuarios(params?: { q?: string; page?: number; pageSize?: number; tipo?: 'cliente' | 'vet' | 'admin'; status?: 0 | 1; verification?: 'pending' | 'approved' | 'rejected'; city?: string; uf?: string; from?: string; to?: string }): Observable<Paged<PessoaDto>> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.q) httpParams = httpParams.set('q', params.q);
      if (params.page) httpParams = httpParams.set('page', String(params.page));
      if (params.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
      if (params.tipo) httpParams = httpParams.set('tipo', params.tipo);
      if (typeof params.status === 'number') httpParams = httpParams.set('status', String(params.status));
      if (params.verification) httpParams = httpParams.set('verification', params.verification);
      if (params.city) httpParams = httpParams.set('city', params.city);
      if (params.uf) httpParams = httpParams.set('uf', params.uf);
      if (params.from) httpParams = httpParams.set('from', params.from);
      if (params.to) httpParams = httpParams.set('to', params.to);
    }
    return this.http.get<Paged<PessoaDto>>(`${this.baseUrl}/usuarios`, { headers: this.headers(), params: httpParams });
  }
  getUsuario(id: string | number): Observable<PessoaDto> {
    return this.http.get<PessoaDto>(`${this.baseUrl}/usuarios/${id}`, { headers: this.headers() });
  }
  updateUsuario(id: string | number, body: Partial<PessoaDto>): Observable<PessoaDto> {
    return this.http.put<PessoaDto>(`${this.baseUrl}/usuarios/${id}`, body, { headers: this.headers() });
  }

  // Pessoas unificado (/admin/people)
  listPeople(params?: { q?: string; page?: number; pageSize?: number; tipo?: 'cliente' | 'vet' | 'admin' }): Observable<Paged<PessoaDto>> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.q) httpParams = httpParams.set('q', params.q);
      if (params.page) httpParams = httpParams.set('page', String(params.page));
      if (params.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
      if (params.tipo) httpParams = httpParams.set('tipo', params.tipo);
    }
    return this.http.get<Paged<PessoaDto>>(`${this.baseUrl.replace('/admin','')}/admin/people`, { headers: this.headers(), params: httpParams });
  }
  getPerson(id: string | number, tipo?: 'cliente' | 'vet' | 'admin'): Observable<PessoaDto> {
    let httpParams = new HttpParams();
    if (tipo) httpParams = httpParams.set('tipo', tipo);
    return this.http.get<PessoaDto>(`${this.baseUrl.replace('/admin','')}/admin/people/${id}`, { headers: this.headers(), params: httpParams });
  }
  createPerson(body: { tipo: 'cliente' | 'vet' | 'admin' } & Record<string, any>): Observable<PessoaDto> {
    return this.http.post<PessoaDto>(`${this.baseUrl.replace('/admin','')}/admin/people`, body, { headers: this.headers() });
  }
  updatePerson(id: string | number, tipo: 'cliente' | 'vet' | 'admin', body: Record<string, any>): Observable<PessoaDto> {
    // Backend exige tipo no body
    return this.http.put<PessoaDto>(`${this.baseUrl.replace('/admin','')}/admin/people/${id}`, { tipo, ...body }, { headers: this.headers() });
  }
  deletePerson(id: string | number, tipo?: 'cliente' | 'vet' | 'admin'): Observable<{ ok: boolean }> {
    let httpParams = new HttpParams();
    if (tipo) httpParams = httpParams.set('tipo', tipo);
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl.replace('/admin','')}/admin/people/${id}`, { headers: this.headers(), params: httpParams });
  }

  // Documentos por usuário
  listUsuarioDocs(id: string | number): Observable<PessoaDocDto[]> {
    return this.http.get<PessoaDocDto[]>(`${this.baseUrl}/usuarios/${id}/docs`, { headers: this.headers() });
  }
  uploadUsuarioDoc(id: string | number, file: File, tipo: PessoaDocDto['tipo']): Observable<PessoaDocDto> {
    const form = new FormData();
    form.append('file', file);
    form.append('tipo', tipo);
    return this.http.post<PessoaDocDto>(`${this.baseUrl}/usuarios/${id}/docs`, form, { headers: this.headers() });
  }
  deleteUsuarioDoc(id: string | number, docId: string | number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/usuarios/${id}/docs/${docId}`, { headers: this.headers() });
  }

  // Vet - aprovação e auditoria
  approveVet(id: string | number, body?: { reason?: string }): Observable<PessoaDto> {
    return this.http.post<PessoaDto>(`${this.baseUrl.replace('/admin','')}/admin/people/vets/${id}/approve`, body || {}, { headers: this.headers() });
  }
  rejectVet(id: string | number, body: { reason?: string }): Observable<PessoaDto> {
    return this.http.post<PessoaDto>(`${this.baseUrl.replace('/admin','')}/admin/people/vets/${id}/reject`, body || {}, { headers: this.headers() });
  }
  listVetApprovals(id: string | number): Observable<Array<{ id: number; vet_id: number; admin_id: number; admin_email: string; admin_nome?: string; approved: 0|1; reason?: string; ip?: string; created_at: string }>> {
    return this.http.get<Array<{ id: number; vet_id: number; admin_id: number; admin_email: string; admin_nome?: string; approved: 0|1; reason?: string; ip?: string; created_at: string }>>(`${this.baseUrl.replace('/admin','')}/admin/people/vets/${id}/approvals`, { headers: this.headers() });
  }
  vetAuditLogs(id: string | number): Observable<Array<{ id: number; action: string; reason?: string; created_at: string; admin_id?: number }>> {
    return this.http.get<Array<{ id: number; action: string; reason?: string; created_at: string; admin_id?: number }>>(`${this.baseUrl}/vets/${id}/audit-logs`, { headers: this.headers() });
  }
}
