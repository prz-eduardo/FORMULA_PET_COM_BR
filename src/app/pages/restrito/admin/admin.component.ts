import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../../../services/session.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  hasProducts = true; // ajuste conforme sua lógica
  isAdmin = false;

  constructor(private router: Router, private session: SessionService) {}

  async ngOnInit() {
    // Check backend JWT for admin role
    if (!this.session.hasValidSession(true)) {
      this.router.navigate(['/restrito/login']);
      return;
    }
    this.isAdmin = this.session.isAdmin();
  }

  logout() {
    // Clear local backend token and go to login
    this.session.saveBackendToken('');
    this.router.navigate(['/restrito/login']);
  }

  goToCadastro() { this.router.navigate(['/restrito/cadastro-produto']); }
  goToLista() { this.router.navigate(['/restrito/lista-produtos']); }
  goToUsuarios() { this.router.navigate(['/restrito/usuarios']); }
  goToGuiaAtivos() { this.router.navigate(['/restrito/admin/guia-ativos']); }
}
