import { environment } from './../../environments/environment';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Ativo { id: number; nome: string; descricao: string; doseCaes: string; doseGatos: string; }
export interface Vet { id: string; nome: string; approved: boolean; }

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

  // Receitas
  criarReceita(receita: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/receitas`, receita);
  }

  // Veterinários
  getVet(id: string): Observable<Vet> {
    return this.http.get<Vet>(`${this.baseUrl}/vets/${id}`);
  }

}
