import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminHomeOverviewComponent } from '../../restrito/admin/home-overview/home-overview.component';

type SectionKey = 'operacao' | 'vet' | 'saas' | 'config';

@Component({
  selector: 'app-parceiro-painel',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminHomeOverviewComponent],
  templateUrl: './parceiro-painel.component.html',
  styleUrls: ['./parceiro-painel.component.scss'],
})
export class ParceiroPainelComponent implements OnInit, OnDestroy {
  greeting = 'Olá';
  searchTerm = '';

  private collapsed: Record<string, boolean> = {};

  private sectionItems: Record<SectionKey, string[]> = {
    operacao: [
      'agenda horários atendimento',
      'reservas hotel creche hospedagem',
      'atendimento chat suporte omnichannel',
    ],
    vet: [
      'ativos formulas compostos ingredientes',
      'gerar receita prescricao veterinaria',
      'historico receitas',
      'pacientes pets clientes tutores',
    ],
    saas: [
      'petshop online loja ecommerce',
      'hotel creche hospedagem pets',
      'adestramento treinamento comportamento',
      'planos assinatura financeiro cobranca',
      'relatorios analytics dados',
    ],
    config: [
      'colaboradores equipe funcionarios',
      'perfil conta configuracoes',
    ],
  };

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.greeting = this.computeGreeting();
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('parceiro_painel_collapsed') : null;
      if (raw) this.collapsed = JSON.parse(raw);
    } catch {}
  }

  ngOnDestroy(): void {}

  private computeGreeting(): string {
    const h = new Date().getHours();
    if (h < 5) return 'Boa madrugada';
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    const target = ev.target as HTMLElement | null;
    const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    if (!typing && ev.key === '/') {
      const input = document.querySelector<HTMLInputElement>('.hero-search input');
      if (input) { ev.preventDefault(); input.focus(); }
    }
  }

  private normalize(v: string): string {
    return (v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  matches(keywords: string): boolean {
    const q = this.normalize(this.searchTerm);
    if (!q) return true;
    return this.normalize(keywords).includes(q);
  }

  sectionHasMatches(key: SectionKey): boolean {
    if (!this.searchTerm) return true;
    return (this.sectionItems[key] || []).some((k) => this.matches(k));
  }

  sectionCount(key: SectionKey): number {
    if (!this.searchTerm) return (this.sectionItems[key] || []).length;
    return (this.sectionItems[key] || []).filter((k) => this.matches(k)).length;
  }

  hasAnyMatch(): boolean {
    return (Object.keys(this.sectionItems) as SectionKey[]).some((k) => this.sectionHasMatches(k));
  }

  isCollapsed(key: string): boolean { return !!this.collapsed[key]; }

  toggleSection(key: string): void {
    this.collapsed[key] = !this.collapsed[key];
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('parceiro_painel_collapsed', JSON.stringify(this.collapsed));
      }
    } catch {}
  }

  // ── Navigation ──────────────────────────────────────────────────────────────
  goToAgenda(): void         { this.router.navigate(['/parceiros/agenda']); }
  goToAreaVet(): void        { this.router.navigate(['/parceiros/area-vet']); }
  goToGerarReceita(): void   { this.router.navigate(['/parceiros/gerar-receita']); }
  goToHistorico(): void      { this.router.navigate(['/parceiros/historico-receitas']); }
  goToPacientes(): void      { this.router.navigate(['/parceiros/pacientes']); }
  goToColaboradores(): void  { this.router.navigate(['/parceiros/agenda']); }
}
