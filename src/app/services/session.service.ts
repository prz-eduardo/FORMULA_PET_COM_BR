import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { jwtDecode } from 'jwt-decode';

interface SessionResponse {
  token: string;
  role?: string;
  user?: any;
  exp?: number;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private baseUrl = environment.apiBaseUrl;
  private isSuperKey = 'is_super';
  private userKey = 'admin_user';

  constructor(private http: HttpClient, private auth: AuthService) {}

  /**
   * Exchanges a Firebase ID token for a backend session JWT.
   * Sends the ID token as a Bearer header to the backend.
   */
  exchangeIdToken(idToken: string, payload?: { email?: string; loginType?: 'admin' | 'cliente' | string; provider?: 'google' | string }) {
    const body = {
      email: payload?.email,
      loginType: payload?.loginType ?? 'admin',
      provider: payload?.provider ?? 'google'
    };
    return this.http.post<SessionResponse>(`${this.baseUrl}/auth/session`, body, {
      headers: { Authorization: `Bearer ${idToken}` }
    });
  }

  /**
   * Admin login using email + password against backend (/auth/admin/login).
   * Returns the same SessionResponse shape as exchangeIdToken.
   */
  adminLoginPassword(email: string, senha: string) {
    return this.http.post<SessionResponse>(`${this.baseUrl}/auth/admin/login`, {
      email: (email || '').trim().toLowerCase(),
      senha
    });
  }

  /** Returns the backend JWT from storage, if any. */
  getBackendToken(): string | null {
    return this.auth.getToken();
  }

  /** Saves backend token using existing AuthService storage semantics */
  saveBackendToken(token: string) {
    this.auth.setToken(token);
  }

  /** Decodes the backend JWT payload safely. */
  decodeToken(token?: string): any | null {
    try {
      const t = token ?? this.getBackendToken();
      if (!t) return null;
      return jwtDecode<any>(t);
    } catch {
      return null;
    }
  }

  /** Checks whether the backend token exists, is not expired, and (optionally) has admin role. */
  hasValidSession(requireAdmin = false): boolean {
    const decoded = this.decodeToken();
    if (!decoded) return false;
    // exp in seconds
    if (typeof decoded.exp === 'number') {
      const nowSec = Math.floor(Date.now() / 1000);
      if (decoded.exp < nowSec) return false;
    }
    if (requireAdmin) {
      const role = decoded.role || decoded['https://petsphere/role'] || decoded.tipo;
      if (role !== 'admin') return false;
    }
    return true;
  }

  /** Returns true if decoded role is admin. */
  isAdmin(): boolean {
    const decoded = this.decodeToken();
    const role = decoded?.role || decoded?.['https://petsphere/role'] || decoded?.tipo;
    return role === 'admin';
  }

  /** Set super admin flag in storage (fallback if token claim not present) */

  setIsSuper(isSuper: boolean) {
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(this.isSuperKey, isSuper ? '1' : '0'); } catch {}
    }
  }

  /** Return true if user is super admin (by token claim or stored flag) */
  isSuper(): boolean {
    const decoded = this.decodeToken();
    if (decoded && (decoded.is_super === 1 || decoded.is_super === true || decoded.is_super === '1')) return true;
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem(this.isSuperKey) === '1';
      } catch {
        return false;
      }
    }
    return false;
  }

  setUser(user: any) {
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(this.userKey, JSON.stringify(user)); } catch {}
    }
  }

  getUser<T = any>(): T | null {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(this.userKey);
        return raw ? JSON.parse(raw) as T : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  /** Returns the backend base URL (for admin modules that call custom endpoints). */
  getBackendBaseUrl(): string {
    return this.baseUrl;
  }

  /** Returns { Authorization: Bearer <token> } if token exists, else undefined */
  getAuthHeaders(): { Authorization: string } | undefined {
    const t = this.getBackendToken();
    return t ? { Authorization: `Bearer ${t}` } : undefined;
  }
}
