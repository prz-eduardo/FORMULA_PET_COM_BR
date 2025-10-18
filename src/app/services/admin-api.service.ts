import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
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
  created_at?: string;
  updated_at?: string;
}

export interface Paged<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private baseUrl = `${environment.apiBaseUrl}/admin`;

  constructor(private http: HttpClient, private session: SessionService) {}

  private headers(): HttpHeaders {
    const token = this.session.getBackendToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // Produtos
  listProdutos(params?: { q?: string; page?: number; pageSize?: number; category?: string; tag?: string }): Observable<Paged<ProdutoDto>> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.q) httpParams = httpParams.set('q', params.q);
      if (params.page) httpParams = httpParams.set('page', String(params.page));
      if (params.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
      if (params.category) httpParams = httpParams.set('category', params.category);
      if (params.tag) httpParams = httpParams.set('tag', params.tag);
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
