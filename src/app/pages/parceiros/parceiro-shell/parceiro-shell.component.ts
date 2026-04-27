import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';
import { Parceiro, PartnerType } from '../../../types/agenda.types';

@Component({
  selector: 'app-parceiro-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './parceiro-shell.component.html',
  styleUrls: ['./parceiro-shell.component.scss'],
})
export class ParceiroShellComponent implements OnInit {
  parceiro = signal<Parceiro | null>(null);
  showUserMenu = signal(false);

  tipoLabel = computed(() => {
    const map: Record<PartnerType, string> = {
      PETSHOP: 'PetShop',
      CLINIC: 'Clínica Vet.',
      SITTER: 'Pet Sitter',
      HOTEL: 'Hotel',
    };
    return map[this.parceiro()?.tipo ?? 'PETSHOP'];
  });

  constructor(
    private auth: ParceiroAuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.parceiro.set(this.auth.getCurrentParceiro());
  }

  toggleUserMenu(val?: boolean): void {
    this.showUserMenu.set(val ?? !this.showUserMenu());
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/parceiros/login']);
  }

  /** Demo: switch partner type from header */
  switchTipo(tipo: PartnerType): void {
    this.auth.setTipo(tipo);
    this.parceiro.set(this.auth.getCurrentParceiro());
    this.toggleUserMenu(false);
    // reload agenda shell to re-apply config
    this.router.navigate(['/parceiros/agenda'], { queryParams: { t: Date.now() } });
  }
}
