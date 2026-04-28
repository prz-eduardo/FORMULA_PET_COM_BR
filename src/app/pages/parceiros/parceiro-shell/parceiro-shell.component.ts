import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
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
  showVetMenu = signal(false);
  private currentUrl = '';

  constructor(
    private auth: ParceiroAuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.colaborador.set(this.auth.getCurrentColaborador());
    this.currentUrl = this.router.url;
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.currentUrl = e.urlAfterRedirects || e.url;
        this.showVetMenu.set(false);
        this.showUserMenu.set(false);
      });
  }

  isVetActive(): boolean {
    return this.currentUrl.includes('/parceiros/area-vet') ||
           this.currentUrl.includes('/parceiros/gerar-receita') ||
           this.currentUrl.includes('/parceiros/historico-receitas') ||
           this.currentUrl.includes('/parceiros/pacientes');
  }

  toggleUserMenu(val?: boolean): void {
    this.showUserMenu.set(val ?? !this.showUserMenu());
    if (this.showUserMenu()) this.showVetMenu.set(false);
  }

  toggleVetMenu(val?: boolean): void {
    this.showVetMenu.set(val ?? !this.showVetMenu());
    if (this.showVetMenu()) this.showUserMenu.set(false);
  }

  goToPainel(): void {
    this.router.navigate(['/parceiros/painel']);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/parceiros/login']);
  }
}
