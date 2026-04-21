import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SessionService } from '../../../../services/session.service';

@Component({
  selector: 'app-meu-perfil-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './meu-perfil-admin.component.html',
  styleUrls: ['./meu-perfil-admin.component.scss']
})
export class MeuPerfilAdminComponent implements OnInit {
  user: any = null;

  constructor(private session: SessionService, private router: Router) {}

  ngOnInit(): void {
    // Prefer stored admin user; fallback to token claims
    this.user = this.session.getUser() || this.session.decodeToken() || null;
  }

  voltar() {
    this.router.navigate(['/restrito/admin']);
  }
}
