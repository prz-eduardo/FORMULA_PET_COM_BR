import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * AdminListingComponent — shell visual padrão para qualquer página
 * administrativa (tabelas + filtros + busca + paginação).
 *
 * Slots:
 *  - [slot=title]         título da página
 *  - [slot=search]        controle de busca rápida
 *  - [slot=filters]       chips/selects de filtros rápidos (linha dedicada)
 *  - [slot=actions]       botões principais (à direita do header)
 *  - [slot=table]         corpo da tabela
 *  - [slot=detail]        área lateral de detalhe (opcional)
 *  - [slot=pagination]    paginação
 */
@Component({
  selector: 'app-admin-listing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-listing.component.html',
  styleUrls: ['./admin-listing.component.scss']
})
export class AdminListingComponent {
  @Input() loading = false;
  /** Total de itens (exibido como badge no cabeçalho). */
  @Input() total: number | null = null;
  /** Rótulo curto exibido à esquerda do badge. Ex.: "fórmulas". */
  @Input() totalLabel = '';
  /** Mostrar separador/row de filtros mesmo sem conteúdo projetado. */
  @Input() showFilters = true;

  /** Dispara ao clicar no botão de limpar filtros (ícone à direita dos filtros). */
  @Output() clearFilters = new EventEmitter<void>();
  @Input() showClearFilters = false;

  emitClear() { this.clearFilters.emit(); }
}
