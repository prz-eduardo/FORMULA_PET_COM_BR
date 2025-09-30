import { Injectable } from '@angular/core';
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

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private loggedInSubject = new BehaviorSubject<boolean>(!!localStorage.getItem('token'));
  isLoggedIn$ = this.loggedInSubject.asObservable();

  public user$ = new BehaviorSubject<User | null>(null);

  constructor() {
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
    localStorage.setItem('token', token);
    this.loggedInSubject.next(true);
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

  // Registrar Vet no Firestore (se ainda quiser manter dados extras)
  async registerVetFirestore(uid: string, data: any) {
    const ref = doc(db, 'vets', uid);
    await setDoc(ref, data);
  }

  async getVetFirestore(uid: string) {
    const ref = doc(db, 'vets', uid);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  }

  // AuthService
  logout() {
    localStorage.removeItem('token');
    this.loggedInSubject.next(false);
  }

  getToken(): string | undefined {
    return localStorage.getItem('token') || undefined;
  }
}
