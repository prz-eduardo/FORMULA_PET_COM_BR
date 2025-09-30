import { environment } from './../../environments/environment';
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

  // front
  loginVet(payload: { email?: string; senha?: string; idToken?: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/vets/login-vet`, payload);
  }

}
