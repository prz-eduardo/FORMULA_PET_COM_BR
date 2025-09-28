import { Injectable } from '@angular/core';
import { auth, db } from '../firebase-config';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { setDoc, doc, getDoc } from 'firebase/firestore';
import { collection, getDocs } from 'firebase/firestore';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private userSubject = new BehaviorSubject<User | null>(null);
  user$ = this.userSubject.asObservable();

    constructor() {
    onAuthStateChanged(auth, (user) => {
      this.userSubject.next(user);
    });
  }

  getCurrentUser() {
    return auth.currentUser;
  }

  async loginEmail(email: string, senha: string) {
    return await signInWithEmailAndPassword(auth, email, senha);
  }

  async loginGoogle() {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result.user;
  }

  async registerVet(email: string, senha: string, nome: string, cpf: string, crmv: string, telefone: string) {
    let user;

    if (senha === 'firebase-google') {
      // cadastro via Google
      user = auth.currentUser;
      if (!user) throw new Error('Usuário Google não autenticado');
    } else {
      // cadastro normal
      const cred = await createUserWithEmailAndPassword(auth, email, senha);
      user = cred.user;
    }

    // cria documento no Firestore somente se não existir
    const docRef = doc(db, 'vets', user.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      await setDoc(docRef, {
        uid: user.uid,
        nome,
        email,
        cpf,
        crmv,
        telefone,
        approved: false,
        authType: senha === 'firebase-google' ? 'google' : 'email',
        criadoEm: new Date()
      });
    }

    return user;
  }

  async getVet(uid: string) {
    const snap = await getDoc(doc(db, 'vets', uid));
    return snap.exists() ? snap.data() : null;
  }

  async verificarVetPorCrmvCpf(crmv: string, cpf: string): Promise<boolean> {
    const vetsCol = collection(db, 'vets');
    const vetsSnap = await getDocs(vetsCol);
    const vets: { crmv: string; cpf: string }[] = vetsSnap.docs.map(d => d.data() as any);
    return vets.some(v => v.crmv === crmv || v.cpf === cpf);
  }

    async sendPasswordReset(email: string) {
    // return await auth.sendPasswordResetEmail(auth, email);
    }

}

