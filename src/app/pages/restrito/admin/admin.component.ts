import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { db } from '../../../firebase-config';
import { collection, getDocs } from 'firebase/firestore';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {

  hasProducts: boolean = false;

  constructor(private router: Router) {}

  async ngOnInit() {
    try {
      const colRef = collection(db, 'produtos');
      const snapshot = await getDocs(colRef);
      this.hasProducts = snapshot.size > 0; // se tiver docs, ativa a lista
    } catch (err) {
      console.error('Erro ao checar produtos:', err);
      this.hasProducts = false;
    }
  }

  logout() {
    // const auth = getAuth();
    // signOut(auth).then(() => this.router.navigate(['/restrito/login']));
  }

  goToCadastro() {
    this.router.navigate(['/restrito/produto']);
  }

  goToLista() {
    if(this.hasProducts){
      this.router.navigate(['/restrito/lista-produtos']);
    }
  }
}
