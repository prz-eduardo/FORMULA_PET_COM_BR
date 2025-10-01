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

    // inicializa o loggedInSubject de forma segura
    if (this.isBrowser) {
      const hasToken = !!localStorage.getItem(this.tokenKey);
      this.loggedInSubject = new BehaviorSubject<boolean>(hasToken);
      this.loggedIn.next(hasToken);
    } else {
      this.loggedInSubject = new BehaviorSubject<boolean>(false);
    }

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

  login(token: string) {
    if (this.isBrowser) {
      localStorage.setItem(this.tokenKey, token);
      this.loggedIn.next(true);   // aqui já dispara pros componentes
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
    return localStorage.getItem(this.tokenKey);
  }

  setToken(token: string) {
    if (this.isBrowser) {
      localStorage.setItem(this.tokenKey, token);
      this.loggedIn.next(true);
      this.loggedInSubject.next(true);
    }
  }

  logout() {
    if (this.isBrowser) {
      localStorage.removeItem(this.tokenKey);
      this.loggedIn.next(false);
      this.loggedInSubject.next(false);
    }
  }
}
