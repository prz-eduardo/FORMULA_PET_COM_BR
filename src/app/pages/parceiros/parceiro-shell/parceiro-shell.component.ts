import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';
import { Colaborador } from '../../../types/agenda.types';

@Component({
  selector: 'app-parceiro-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './parceiro-shell.component.html',
  styleUrls: ['./parceiro-shell.component.scss'],
})
export class ParceiroShellComponent implements OnInit {
  colaborador = signal<Colaborador | null>(null);
  showUserMenu = signal(false);

  constructor(
    private auth: ParceiroAuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.colaborador.set(this.auth.getCurrentColaborador());
  }

  toggleUserMenu(val?: boolean): void {
    this.showUserMenu.set(val ?? !this.showUserMenu());
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/parceiros/login']);
  }
}
