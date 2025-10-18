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

export interface FornecedorDto { id: number; nome: string }

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

  // Dashboard
  getDashboard(): Observable<any> {
    return this.http.get<any>(this.dashboardUrl, { headers: this.headers() });
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

  // Usuários
  listUsuarios(params?: { q?: string; page?: number; pageSize?: number; tipo?: 'cliente' | 'vet' | 'admin' }): Observable<Paged<any>> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.q) httpParams = httpParams.set('q', params.q);
      if (params.page) httpParams = httpParams.set('page', String(params.page));
      if (params.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
      if (params.tipo) httpParams = httpParams.set('tipo', params.tipo);
    }
    return this.http.get<Paged<any>>(`${this.baseUrl}/usuarios`, { headers: this.headers(), params: httpParams });
  }

  updateUsuario(id: string | number, body: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/usuarios/${id}`, body, { headers: this.headers() });
  }
}
