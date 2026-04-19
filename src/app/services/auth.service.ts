import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { auth, db } from '../firebase-config';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { BehaviorSubject } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';


@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isBrowser: boolean;
  private tokenKey = 'token';
  private loggedIn = new BehaviorSubject<boolean>(false);
  public isLoggedIn$ = this.loggedIn.asObservable();
  private loggedInSubject: BehaviorSubject<boolean>;

  public user$ = new BehaviorSubject<User | null>(null);

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);

    // inicializa o loggedInSubject de forma segura (evita acessar localStorage no server)
    let initialLogged = false;
    if (this.isBrowser && typeof window !== 'undefined' && typeof (window as any).localStorage !== 'undefined') {
      try {
        const hasToken = !!(window as any).localStorage.getItem(this.tokenKey) || !!(window as any).sessionStorage.getItem(this.tokenKey);
        initialLogged = !!hasToken;
      } catch {}
    }
    this.loggedInSubject = new BehaviorSubject<boolean>(initialLogged);
    this.loggedIn.next(initialLogged);

    onAuthStateChanged(auth, user => {
      this.user$.next(user);
    });
  }

  // Retorna usuário atual
  getCurrentUser(): User | null {
    return auth.currentUser;
  }

  // Cadastro com email/senha
  async registerEmail(email: string, senha: string) {
    return await createUserWithEmailAndPassword(auth, email, senha);
  }

  // Login com email/senha
  async loginEmail(email: string, senha: string) {
    return await signInWithEmailAndPassword(auth, email, senha);
  }

  // Login com Google
  async loginGoogle() {
    const provider = new GoogleAuthProvider();
    return await signInWithPopup(auth, provider);
  }

  /**
   * Guarda o token do usuário.
   * @param token JWT
   * @param persist se true usa localStorage (persistente), se false usa sessionStorage (apaga ao fechar navegador)
   */
  login(token: string, persist: boolean = true) {
    if (!this.isBrowser) return;
    // remove de ambos antes de setar no local correto
    sessionStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.tokenKey);
    // Only set token if it's a non-empty string and not the literal 'undefined'/'null'
    if (token && typeof token === 'string' && token !== 'undefined' && token !== 'null') {
      if (persist) {
        localStorage.setItem(this.tokenKey, token);
      } else {
        sessionStorage.setItem(this.tokenKey, token);
      }
      this.loggedIn.next(true);
      this.loggedInSubject.next(true);
    } else {
      // invalid token -> ensure logged out state
      this.loggedIn.next(false);
      this.loggedInSubject.next(false);
    }
  }

  // Reset de senha
  async sendPasswordReset(email: string) {
    return await sendPasswordResetEmail(auth, email);
  }

  // Pegar ID Token JWT do usuário logado
  async getIdToken(): Promise<string> {
    if (!auth.currentUser) {
      throw new Error('Usuário não logado');
    }
    return await auth.currentUser.getIdToken();
  }

  // Registrar Vet no Firestore
  async registerVetFirestore(uid: string, data: any) {
    const ref = doc(db, 'vets', uid);
    await setDoc(ref, data);
  }

  async getVetFirestore(uid: string) {
    const ref = doc(db, 'vets', uid);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  }

  getToken(): string | null {
    if (!this.isBrowser) return null;
    if (typeof window === 'undefined' || typeof (window as any).localStorage === 'undefined') return null;
    // Prioriza localStorage (persistente), fallback para sessionStorage
    try {
      const fromLocal = (window as any).localStorage.getItem(this.tokenKey);
      const fromSession = (window as any).sessionStorage.getItem(this.tokenKey);
      const pick = fromLocal || fromSession || null;
      if (!pick) return null;
      if (pick === 'undefined' || pick === 'null') return null;
      return pick;
    } catch {
      return null;
    }
  }

  setToken(token: string) {
    // manter compatibilidade: armazena em localStorage (no-op no server)
    if (!this.isBrowser || typeof window === 'undefined') return;
    try {
      if (token && token !== 'undefined' && token !== 'null') {
        (window as any).localStorage.setItem(this.tokenKey, token);
        this.loggedIn.next(true);
        this.loggedInSubject.next(true);
      } else {
        (window as any).localStorage.removeItem(this.tokenKey);
        this.loggedIn.next(false);
        this.loggedInSubject.next(false);
      }
    } catch {}
  }

  logout() {
    if (!this.isBrowser || typeof window === 'undefined') return;
    try {
      // remove de ambos os storages
      (window as any).localStorage.removeItem(this.tokenKey);
      (window as any).sessionStorage.removeItem(this.tokenKey);
      this.loggedIn.next(false);
      this.loggedInSubject.next(false);
    } catch {}
  }
}
