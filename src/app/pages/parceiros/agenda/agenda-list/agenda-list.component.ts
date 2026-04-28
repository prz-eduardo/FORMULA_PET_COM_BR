import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Agendamento, AgendaStatus } from '../../../../types/agenda.types';
import { QuickActionEvent } from '../agenda-card/agenda-card.component';
import { getTime } from '../utils/date-helpers';

type SortCol = 'inicio' | 'pet' | 'servico' | 'profissional' | 'status';
type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-agenda-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './agenda-list.component.html',
  styleUrls: ['./agenda-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaListComponent {
  @Input() agendamentos: Agendamento[] = [];
  @Output() quickAction = new EventEmitter<QuickActionEvent>();
  @Output() openModal = new EventEmitter<string>();

  sortCol = signal<SortCol>('inicio');
  sortDir = signal<SortDir>('asc');

  readonly STATUS_LABELS: Record<AgendaStatus, string> = {
    AGENDADO: 'Agendado',
    CONFIRMADO: 'Confirmado',
    EM_ANDAMENTO: 'Em andamento',
    ATRASADO: 'Atrasado',
    FINALIZADO: 'Finalizado',
    CANCELADO: 'Cancelado',
  };

  get sorted(): Agendamento[] {
    const col = this.sortCol();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return [...this.agendamentos].sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (col) {
        case 'inicio':  va = getTime(a.inicio); vb = getTime(b.inicio); break;
        case 'pet':     va = a.pet?.nome ?? ''; vb = b.pet?.nome ?? ''; break;
        case 'servico': va = a.servico?.nome ?? ''; vb = b.servico?.nome ?? ''; break;
        case 'profissional': va = a.profissional?.nome ?? ''; vb = b.profissional?.nome ?? ''; break;
        case 'status':  va = a.status; vb = b.status; break;
        default: va = 0; vb = 0;
      }
      if (typeof va === 'string') return va.localeCompare(vb as string) * dir;
      return ((va as number) - (vb as number)) * dir;
    });
  }

  setSort(col: SortCol): void {
    if (this.sortCol() === col) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortCol.set(col);
      this.sortDir.set('asc');
    }
  }

  sortIcon(col: SortCol): string {
    if (this.sortCol() !== col) return '↕';
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  formatTime(d: Date | string): string {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  nextActions(a: Agendamento): Array<{ type: string; label: string; danger: boolean }> {
    const map: Record<AgendaStatus, Array<{ type: string; label: string; danger: boolean }>> = {
      AGENDADO: [{ type: 'CONFIRMAR', label: 'Confirmar', danger: false }],
      CONFIRMADO: [{ type: 'INICIAR', label: 'Iniciar', danger: false }],
      EM_ANDAMENTO: [{ type: 'FINALIZAR', label: 'Finalizar', danger: false }],
      ATRASADO: [
        { type: 'INICIAR', label: 'Iniciar', danger: false },
        { type: 'CANCELAR', label: 'Cancelar', danger: true },
      ],
      FINALIZADO: [],
      CANCELADO: [],
    };
    return map[a.status];
  }

  onAction(id: string | number, type: string, event: Event): void {
    event.stopPropagation();
    this.quickAction.emit({ id: String(id), action: type as QuickActionEvent['action'] });
  }

  asString(value: string | number): string {
    return String(value);
  }
}
