import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { Colaborador, SessionColaborador, RoleColaborador } from '../types/agenda.types';

const STORAGE_KEY = 'parceiro_token';
const API_BASE = '/api'; // Adjust based on your config

@Injectable({ providedIn: 'root' })
export class ParceiroAuthService {
  private session: SessionColaborador | null = null;

  constructor(private http: HttpClient) {
    this.loadSessionFromStorage();
  }

  /**
   * Realiza login com email e senha
   * POST /parceiro/auth/login
   */
  async login(email: string, senha: string): Promise<{ token: string; colaborador: Colaborador }> {
    try {
      const response = await lastValueFrom(
        this.http.post<{ token: string; colaborador: Colaborador }>(
          `${API_BASE}/parceiro/auth/login`,
          { email, senha }
        )
      );

      // Cria sessão com 8 horas de expiração
      this.session = {
        colaborador: response.colaborador,
        token: response.token,
        expiresAt: Date.now() + 8 * 60 * 60 * 1000,
      };

      // Salva no localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.session));

      return response;
    } catch (error) {
      console.error('Erro no login:', error);
      throw error;
    }
  }

  /**
   * Faz logout
   */
  logout(): void {
    this.session = null;
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Retorna o colaborador atualmente autenticado
   */
  getCurrentColaborador(): Colaborador | null {
    if (!this.session) return null;
    if (this.session.expiresAt < Date.now()) {
      this.logout();
      return null;
    }
    return this.session.colaborador;
  }

  /**
   * Retorna informações do parceiro atual (para compatibilidade com shell)
   */
  getCurrentParceiro(): { tipo: 'PETSHOP' | 'CLINIC' | 'SITTER' | 'HOTEL' } | null {
    return { tipo: 'PETSHOP' }; // Default partner type
  }

  /**
   * Retorna o token JWT
   */
  getToken(): string | null {
    if (!this.session) return null;
    if (this.session.expiresAt < Date.now()) {
      this.logout();
      return null;
    }
    return this.session.token;
  }

  /**
   * Retorna headers para requisições autenticadas
   */
  getAuthHeaders(): { Authorization: string } | {} {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Verifica se está autenticado
   */
  isLoggedIn(): boolean {
    return this.getCurrentColaborador() !== null;
  }

  /**
   * Retorna role do colaborador
   */
  getRole(): RoleColaborador | null {
    return this.getCurrentColaborador()?.role ?? null;
  }

  /**
   * Verifica se é master
   */
  isMaster(): boolean {
    return this.getRole() === 'master';
  }

  /**
   * Carrega sessão do localStorage se existir
   */
  private loadSessionFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const session: SessionColaborador = JSON.parse(raw);
      if (session.expiresAt < Date.now()) {
        this.logout();
      } else {
        this.session = session;
      }
    } catch {
      // Sessão corrompida, limpa
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}
