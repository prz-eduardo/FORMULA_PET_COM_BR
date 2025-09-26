import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { auth, db } from '../../../firebase-config';
import { signOut } from 'firebase/auth';
import { collection, getDocs, getDoc, doc, setDoc } from 'firebase/firestore';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  hasProducts = true; // ajuste conforme sua lógica
  isAdmin = false;

  constructor(private router: Router) {}

  async ngOnInit() {
    const user = auth.currentUser;
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    // Verifica role no Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      this.isAdmin = userDoc.data()['role'] === 'admin';
    }
  }

  logout() {
    signOut(auth).then(() => this.router.navigate(['/login']));
  }

  goToCadastro() { this.router.navigate(['/restrito/cadastro-produto']); }
  goToLista() { this.router.navigate(['/restrito/lista-produtos']); }
  goToUsuarios() { this.router.navigate(['/restrito/usuarios']); }
}
