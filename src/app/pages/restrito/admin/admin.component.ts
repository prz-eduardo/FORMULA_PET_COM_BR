import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

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

  ngOnInit() {
    const produtosStored = localStorage.getItem('produtos');
    const produtos = produtosStored ? JSON.parse(produtosStored) : [];
    this.hasProducts = produtos.length > 0;
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
