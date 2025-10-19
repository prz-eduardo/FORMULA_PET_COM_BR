import { environment } from '../../enviroments/environment';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Ativo {
  id: string;
  nome: string;
  descricao: string;
  doseCaes: string;
  doseGatos: string;
  open?: boolean; // adiciona aqui para controlar o acordeon
}

export interface Veterinario {
  id: string;
  nome: string;
  cpf: string;
  crmv: string;
  email: string;
  telefone?: string;
  tipo: string;
  approved: boolean;
}


export interface Vet {
  id: string;
  nome: string;
  approved: boolean;
  tipo: string;
  token?: string;
}

export interface AuthResponse {
  tipo: string;
  token: string;
  user?: Vet;
}

export interface Cliente {
  id: number;
  nome: string;
  email: string;
  cpf: string;
  telefone?: string;
  tipo: string;
  created_at?: string;
}

export interface ClienteMeResponse {
  user: Cliente;
  tokenExp?: number;
}

export interface AlergiaLookup {
  alergia_id: string | number;
  ativo_id?: string | number;
  nome: string;
}

export interface ReceitaItem {
  id: number;
  ativo_id: number;
  nome_ativo: string;
  ordem: number;
  created_at?: string;
}

export interface Receita {
  id: number;
  vet_id?: number;
  cliente_id: number;
  pet_id: number;
  // Names and display helpers
  pet_nome?: string;
  nome_pet?: string; // sometimes API returns this alias
  cliente_nome?: string;
  endereco_text?: string;
  observacoes?: string;
  alerta_alergia?: boolean | 0 | 1;
  created_at?: string;
  itens?: ReceitaItem[];
  // Signature variants and thumbnail
  assinatura_imagem?: string | null;
  assinatura_manual?: string | null;
  assinatura_cursiva?: string | null;
  assinatura_icp?: string | null;
  // Pet details snapshot
  especie?: string;
  raca?: string;
  sexo?: string;
  idade?: number;
  peso?: string | number;
  // Allergies snapshot
  alergias?: string[];
  // Full raw payload (for debugging/auditing)
  dados_raw?: any;
}

export interface PagedReceitasResponse {
  data: Receita[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// Pacientes (pets atendidos)
export interface TopAtivoUso { nome: string; usos: number; ativo_id?: number; }

export interface PacienteSummary {
  pet_id: number;
  pet_nome: string;
  especie?: string;
  raca?: string;
  sexo?: string;
  cliente_id: number;
  cliente_nome: string;
  cliente_cpf?: string;
  total_atendimentos: number;
  primeiro_atendimento?: string;
  ultimo_atendimento?: string;
  top_ativos?: TopAtivoUso[]; // até 5
}

export interface PagedPacientesResponse {
  data: PacienteSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PacienteDetail {
  pet: {
    id: number;
    nome: string;
    especie?: string;
    raca?: string;
    sexo?: string;
    // Campos extras que podem vir no payload real
    cliente_id?: number;
    cliente_nome?: string;
    cliente_cpf?: string;
    tipo?: string | null;
    photoURL?: string | null;
    created_at?: string;
    pesoKg?: string | number | null;
    idade?: number | null;
    aceito_tutor?: number | boolean | null;
    salvo_vet_id?: number | null;
    observacoes?: string | null;
      alergias?: string[] | null;
      alergias_predefinidas?: Array<{
        nome: string;
        alergia_id?: number | null;
        ativo_id?: number | null;
      }> | null;
  };
  cliente?: {
    id: number;
    nome: string;
    cpf?: string;
    email?: string;
    telefone?: string;
  };
  resumo: {
    total_atendimentos: number;
    primeiro_atendimento?: string;
    ultimo_atendimento?: string;
  };
  ativos_mais_usados: TopAtivoUso[]; // top 10
  ultimas_receitas: Receita[]; // até 5 últimas com itens
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = `${environment.apiBaseUrl}`;

  constructor(private http: HttpClient) {}

  // Ativos
  getAtivos(): Observable<Ativo[]> {
    return this.http.get<Ativo[]>(`${this.baseUrl}/ativos`);
  }

  // Loja - listagem pública de produtos com paginação e filtros
    listStoreProducts(
      params?: {
        page?: number; pageSize?: number; q?: string; tipo?: 'manipulado'|'pronto';
        category?: string; categoryId?: string|number; categories?: string[]; tag?: string; tags?: (string|number)[];
        minPrice?: number; maxPrice?: number; myFavorites?: boolean; promoOnly?: boolean;
        sort?: 'relevance'|'newest'|'price_asc'|'price_desc'|'popularity'|'rating'|'my_favorites'
      },
      token?: string
    ): Observable<{
      data: any[];
      page: number; pageSize: number; total: number; totalPages: number;
      meta?: {
        loggedIn?: boolean;
        userType?: string;
        favoritesPersonalization?: boolean;
        supports?: { images?: boolean; favorites?: boolean; ratings?: boolean; categories?: boolean; tags?: boolean };
        categories?: Array<{ id: number; nome: string; produtos: number }>;
        tags?: Array<{ id: number; nome: string; produtos: number }>;
      };
    }> {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.pageSize) search.set('pageSize', String(params.pageSize));
    if (params?.q) search.set('q', params.q);
    if (params?.tipo) search.set('tipo', params.tipo);
    if (params?.category) search.set('category', params.category);
  if (params?.categoryId != null) search.set('category_id', String(params.categoryId));
    if (params?.categories && params.categories.length) search.set('categories', params.categories.join(','));
    if (params?.tag) search.set('tag', params.tag);
    if (params?.tags && params.tags.length) search.set('tags', params.tags.join(','));
    if (typeof params?.minPrice === 'number') search.set('minPrice', String(params.minPrice));
    if (typeof params?.maxPrice === 'number') search.set('maxPrice', String(params.maxPrice));
    if (params?.myFavorites) search.set('myFavorites', 'true');
  if (params?.sort) search.set('sort', params.sort);
  if (params?.promoOnly) search.set('promo', '1');
    const qp = search.toString();
      const url = `${this.baseUrl}/produtos${qp ? `?${qp}` : ''}`;
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
      return this.http.get<{
        data: any[];
        page: number; pageSize: number; total: number; totalPages: number;
        meta?: {
          loggedIn?: boolean;
          userType?: string;
          favoritesPersonalization?: boolean;
          supports?: { images?: boolean; favorites?: boolean; ratings?: boolean; categories?: boolean; tags?: boolean };
          categories?: Array<{ id: number; nome: string; produtos: number }>;
          tags?: Array<{ id: number; nome: string; produtos: number }>;
        };
      }>(url, { headers });
  }

  // Home - destaques
  getHomeHighlights(token?: string): Observable<any> {
    const url = `${this.baseUrl}/destaques-home`;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.get<any>(url, { headers });
  }

  // Produto - detalhes completos por ID (novo endpoint)
  getProductById(id: number | string, token?: string): Observable<any> {
    const url = `${this.baseUrl}/products/${encodeURIComponent(String(id))}`;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.get<any>(url, { headers });
  }

  // Ativos (busca por termo, se o backend suportar ?q=)
  searchAtivos(q: string): Observable<Ativo[]> {
    const term = (q || '').trim();
    const url = `${this.baseUrl}/ativos${term ? `?q=${encodeURIComponent(term)}` : ''}`;
    return this.http.get<Ativo[]>(url);
  }

  // Receitas
  criarReceita(receita: any, token?: string): Observable<any> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.post(`${this.baseUrl}/receitas`, receita, { headers });
  }

  getVet(id: string, token?: string): Observable<Vet> {
    return this.http.get<Vet>(`${this.baseUrl}/vets/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  }



  // Cadastro de veterinário
  cadastrarVet(vet: {
    nome: string;
    email: string;
    senha?: string;   // opcional no caso do Google
    cpf: string;
    crmv: string;
    telefone: string;
    tipo: string;
    idToken?: string; // se vier do Google, usa token
  }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/vets`, vet);
  }

  // Cadastro de cliente
  cadastrarCliente(cliente: {
    nome: string;
    email: string;
    senha?: string;
    cpf: string;
    telefone: string;
    tipo: string;
    idToken?: string;
  }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/clientes`, cliente);
  }

  // front
  loginVet(payload: { email?: string; senha?: string; idToken?: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/vets/login-vet`, payload);
  }

  // Login cliente
  loginCliente(payload: { email?: string; senha?: string; idToken?: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/clientes/login-cliente`, payload);
  }

  // Pega perfil do cliente autenticado
  getClienteMe(token: string) {
    return this.http.get<ClienteMeResponse>(`${this.baseUrl}/clientes/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  getPetsByCliente(id: number, token: string) {
    return this.http.get<any[]>(`${this.baseUrl}/clientes/${id}/pets`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  getVeterinario(id: string, token: string) {
    return this.http.get<Veterinario>(`${this.baseUrl}/vets/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  consultarPedido(codigo: string, token?: string) {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.get<any>(`${this.baseUrl}/pedidos/${encodeURIComponent(codigo)}`, { headers });
  }

  // Pedidos e Pagamentos (checkout)
  criarPedido(token: string, body: any) {
    return this.http.post<any>(`${this.baseUrl}/pedidos`, body, { headers: { Authorization: `Bearer ${token}` } });
  }
  atualizarPedido(token: string, codigoOuId: string | number, body: any) {
    return this.http.put<any>(`${this.baseUrl}/pedidos/${encodeURIComponent(String(codigoOuId))}`, body, { headers: { Authorization: `Bearer ${token}` } });
  }
  criarPagamento(token: string, pedidoCodigo: string | number, body: any) {
    return this.http.post<any>(`${this.baseUrl}/pedidos/${encodeURIComponent(String(pedidoCodigo))}/pagamentos`, body, { headers: { Authorization: `Bearer ${token}` } });
  }

  // Favoritar/Desfavoritar produto (toggle). Backend deve reconhecer o token do cliente.
  // Resposta esperada genérica: { is_favorited?: boolean, favorited?: boolean, favoritos?: number }
  toggleFavorite(productId: number, token: string) {
    return this.http.post<any>(`${this.baseUrl}/produtos/${productId}/favorite`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  // Criar Pet para um cliente
  createPet(clienteId: number, data: FormData, token: string) {
    return this.http.post<any>(`${this.baseUrl}/clientes/${clienteId}/pets`, data, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  // Atualizar Pet (PUT)
  updatePet(clienteId: number, petId: string | number, data: FormData, token: string) {
    return this.http.put<any>(`${this.baseUrl}/clientes/${clienteId}/pets/${petId}`, data, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  // Atualizar Cliente (PUT)
  updateCliente(clienteId: number, body: any, token: string) {
    return this.http.put<any>(`${this.baseUrl}/clientes/${clienteId}`, body, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  // Buscar cliente por CPF (para veterinários)
  buscarClientePorCpf(cpf: string, token: string): Observable<any> {
    const cpfLimpo = cpf.replace(/\D/g, '');
    return this.http.get<any>(`${this.baseUrl}/clientes/cpf/${cpfLimpo}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  // Buscar cliente com pets incluídos
  buscarClienteComPets(cpf: string, token: string): Observable<any> {
    const cpfLimpo = cpf.replace(/\D/g, '');
    return this.http.get<any>(`${this.baseUrl}/clientes/cpf/${cpfLimpo}?include=pets`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  // Lista predefinida de alergias
  getListaAlergias(token: string, q?: string): Observable<AlergiaLookup[]> {
    const query = q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    return this.http.get<AlergiaLookup[]>(`${this.baseUrl}/get_lista_alergias${query}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  // Receitas - histórico do vet autenticado
  getReceitas(token: string, params?: {
    page?: number;
    pageSize?: number;
    pet_id?: number | string;
    cliente_id?: number | string;
    ativo_id?: number | string;
    from?: string;
    to?: string;
    q?: string;
    availableOnly?: boolean; // somente receitas não usadas (ex.: carrinho)
    context?: string;        // contexto do uso (ex.: 'carrinho')
  }): Observable<PagedReceitasResponse> {
    const search = new URLSearchParams();
    if (params) {
      if (params.page) search.set('page', String(params.page));
      if (params.pageSize) search.set('pageSize', String(params.pageSize));
      if (params.pet_id) search.set('pet_id', String(params.pet_id));
      if (params.cliente_id) search.set('cliente_id', String(params.cliente_id));
      if (params.ativo_id) search.set('ativo_id', String(params.ativo_id));
      if (params.from) search.set('from', params.from);
      if (params.to) search.set('to', params.to);
      if (params.q) search.set('q', params.q);
      if (params.availableOnly) search.set('availableOnly', '1');
      if (params.context) search.set('context', params.context);
    }
    const qp = search.toString();
    const url = `${this.baseUrl}/receitas${qp ? `?${qp}` : ''}`;
    return this.http.get<PagedReceitasResponse>(url, { headers: { Authorization: `Bearer ${token}` } });
  }

  getReceitaById(token: string, id: number | string): Observable<Receita> {
    return this.http.get<Receita>(`${this.baseUrl}/receitas/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  }

  // Pacientes
  getPacientes(token: string, params?: { page?: number; pageSize?: number; q?: string }): Observable<PagedPacientesResponse> {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.pageSize) search.set('pageSize', String(params.pageSize));
    if (params?.q) search.set('q', params.q);
    const qp = search.toString();
    const url = `${this.baseUrl}/pacientes${qp ? `?${qp}` : ''}`;
    return this.http.get<PagedPacientesResponse>(url, { headers: { Authorization: `Bearer ${token}` } });
  }

  getPacienteById(token: string, petId: number | string): Observable<PacienteDetail> {
    return this.http.get<PacienteDetail>(`${this.baseUrl}/pacientes/${petId}`, { headers: { Authorization: `Bearer ${token}` } });
  }

  // Endereços do cliente (suportado por backend; se indisponível, o caller deve tratar gracefully)
  listEnderecosCliente(token: string): Observable<any[]> {
    const url = `${this.baseUrl}/clientes/me/enderecos`;
    return this.http.get<any[]>(url, { headers: { Authorization: `Bearer ${token}` } });
  }

  createEnderecoCliente(token: string, body: {
    cep: string; logradouro: string; numero: string; complemento?: string;
    bairro: string; cidade: string; estado: string; nome?: string; tipo?: string;
  }): Observable<any> {
    const url = `${this.baseUrl}/clientes/me/enderecos`;
    return this.http.post<any>(url, body, { headers: { Authorization: `Bearer ${token}` } });
  }

  // Cálculo de frete (caso o backend exista)
  cotarFrete(token: string | undefined, payload: { cep: string; itens: Array<{ id: number; qtd: number; preco?: number }> }): Observable<{ valor: number; prazo?: string }> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    const url = `${this.baseUrl}/frete/cotar`;
    return this.http.post<{ valor: number; prazo?: string }>(url, payload, { headers });
  }

  // CEP lookups em APIs públicas gratuitas
  buscarCepViaCep(cep: string): Observable<any> {
    const clean = (cep || '').replace(/\D/g, '');
    return this.http.get(`https://viacep.com.br/ws/${clean}/json/`);
  }

  buscarCepBrasilAPI(cep: string): Observable<any> {
    const clean = (cep || '').replace(/\D/g, '');
    return this.http.get(`https://brasilapi.com.br/api/cep/v1/${clean}`);
  }
}
