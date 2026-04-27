import { Injectable } from '@angular/core';
import { Parceiro, PartnerType } from '../types/agenda.types';

const STORAGE_KEY = 'parceiro_session';

interface ParceiroSession {
  parceiro: Parceiro;
  token: string;
  expiresAt: number;
}

@Injectable({ providedIn: 'root' })
export class ParceiroAuthService {

  /** Mock login — in production this calls POST /parceiros/auth/login */
  loginMock(email: string, _password: string): boolean {
    const tipo = this.detectTipoFromEmail(email);
    const session: ParceiroSession = {
      parceiro: {
        id: 'mock-parceiro-1',
        nome: this.nomeFromTipo(tipo),
        tipo,
        logoUrl: undefined,
      },
      token: 'mock-jwt-' + Date.now(),
      expiresAt: Date.now() + 8 * 60 * 60 * 1000, // 8h
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return true;
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  getCurrentParceiro(): Parceiro | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const session: ParceiroSession = JSON.parse(raw);
      if (session.expiresAt < Date.now()) {
        this.logout();
        return null;
      }
      return session.parceiro;
    } catch {
      return null;
    }
  }

  isLoggedIn(): boolean {
    return this.getCurrentParceiro() !== null;
  }

  /** Change partner type (for demo switching) */
  setTipo(tipo: PartnerType): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const session: ParceiroSession = JSON.parse(raw);
      session.parceiro.tipo = tipo;
      session.parceiro.nome = this.nomeFromTipo(tipo);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch { /* empty */ }
  }

  private detectTipoFromEmail(email: string): PartnerType {
    const e = email.toLowerCase();
    if (e.includes('clinic') || e.includes('vet') || e.includes('animal')) return 'CLINIC';
    if (e.includes('sitter') || e.includes('walker')) return 'SITTER';
    if (e.includes('hotel') || e.includes('hospedagem')) return 'HOTEL';
    return 'PETSHOP';
  }

  private nomeFromTipo(tipo: PartnerType): string {
    const map: Record<PartnerType, string> = {
      PETSHOP: 'PetShop Demo',
      CLINIC: 'Clínica Veterinária Demo',
      SITTER: 'Pet Sitter Demo',
      HOTEL: 'Hotel para Pets Demo',
    };
    return map[tipo];
  }
}
