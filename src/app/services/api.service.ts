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


}
