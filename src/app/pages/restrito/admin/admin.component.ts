import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SessionService } from '../../../services/session.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  hasProducts = true; // ajuste conforme sua lógica
  isAdmin = false;
  isSuper = false;
  showUserMenu = false;

  // Persist collapsible state by key
  private collapsed: Record<string, boolean> = {};

  constructor(private router: Router, private session: SessionService) {}

  async ngOnInit() {
    // Check backend JWT for admin role
    if (!this.session.hasValidSession(true)) {
      this.router.navigate(['/restrito/login']);
      return;
    }
    this.isAdmin = this.session.isAdmin();
    this.isSuper = this.session.isSuper();

    // restore collapsed state from localStorage (SSR-safe guard)
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('admin_collapsed') : null;
      if (raw) this.collapsed = JSON.parse(raw);
    } catch {}
  }

  logout() {
    // Clear local backend token and go to login
    this.session.saveBackendToken('');
    this.router.navigate(['/restrito/login']);
  }

  goToCadastro() { this.router.navigate(['/restrito/produto']); }
  goToLista() { this.router.navigate(['/restrito/lista-produtos']); }
  goToUsuarios() { this.router.navigate(['/restrito/admin/usuarios']); }
  goToGuiaAtivos() { this.router.navigate(['/restrito/admin/guia-ativos']); }

  // Extras úteis baseados no app
  goToHistoricoReceitas() { this.router.navigate(['/historico-receitas']); }
  goToPacientes() { this.router.navigate(['/pacientes']); }
  goToAreaVet() { this.router.navigate(['/area-vet']); }
  goToLoja() { this.router.navigate(['/loja']); }
  goToPerfil() { this.router.navigate(['/editar-perfil']); }

  // Novos atalhos do painel admin (rotas placeholders para implementar)
  goToDashboard() { this.router.navigate(['/restrito/admin/dashboard']); }
  goToEstoque() { this.router.navigate(['/restrito/admin/estoque']); }
  goToClientes() { this.router.navigate(['/restrito/admin/clientes']); }
  goToVeterinarios() { this.router.navigate(['/restrito/admin/veterinarios']); }
  goToBanners() { this.router.navigate(['/restrito/admin/banners']); }
  goToPedidos() { this.router.navigate(['/restrito/admin/pedidos']); }
  goToCupons() { this.router.navigate(['/restrito/admin/cupons']); }
  goToPromocoes() { this.router.navigate(['/restrito/admin/promocoes']); }
  goToRelatorios() { this.router.navigate(['/restrito/admin/relatorios']); }
  goToConfiguracoes() { this.router.navigate(['/restrito/admin/configuracoes']); }
  goToFormulas() { this.router.navigate(['/restrito/admin/formulas']); }
  goToMarketplaceCustomizacoes() { this.router.navigate(['/restrito/admin/marketplace/customizacoes']); }
  goToFornecedores() { this.router.navigate(['/restrito/admin/fornecedores']); }
  goToAtivos() { this.router.navigate(['/restrito/admin/ativos']); }
  goToInsumos() { this.router.navigate(['/restrito/admin/insumos']); }

  // Header user menu
  toggleUserMenu(force?: boolean) {
    this.showUserMenu = typeof force === 'boolean' ? force : !this.showUserMenu;
  }

  // Collapsible sections utilities
  isCollapsed(key: string): boolean {
    return !!this.collapsed[key];
  }

  toggleSection(key: string) {
    this.collapsed[key] = !this.collapsed[key];
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('admin_collapsed', JSON.stringify(this.collapsed));
      }
    } catch {}
  }
}
