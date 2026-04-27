import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Agendamento, AgendaStatus } from '../../../../types/agenda.types';

export type QuickActionType = 'CONFIRMAR' | 'INICIAR' | 'FINALIZAR' | 'CANCELAR';

export interface QuickActionEvent {
  id: string;
  action: QuickActionType;
}

@Component({
  selector: 'app-agenda-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './agenda-card.component.html',
  styleUrls: ['./agenda-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaCardComponent {
  @Input() agendamento!: Agendamento;
  /** compact = used inside TIMELINE/GRID where space is tight */
  @Input() compact = false;
  @Output() quickAction = new EventEmitter<QuickActionEvent>();
  @Output() openModal = new EventEmitter<string>(); // emits agendamento.id

  get statusClass(): string {
    const map: Record<AgendaStatus, string> = {
      AGENDADO: 'status-agendado',
      CONFIRMADO: 'status-confirmado',
      EM_ANDAMENTO: 'status-em-andamento',
      ATRASADO: 'status-atrasado',
      FINALIZADO: 'status-finalizado',
      CANCELADO: 'status-cancelado',
    };
    return map[this.agendamento.status];
  }

  get statusLabel(): string {
    const map: Record<AgendaStatus, string> = {
      AGENDADO: 'Agendado',
      CONFIRMADO: 'Confirmado',
      EM_ANDAMENTO: 'Em andamento',
      ATRASADO: 'Atrasado',
      FINALIZADO: 'Finalizado',
      CANCELADO: 'Cancelado',
    };
    return map[this.agendamento.status];
  }

  get nextActions(): QuickActionType[] {
    const map: Record<AgendaStatus, QuickActionType[]> = {
      AGENDADO: ['CONFIRMAR'],
      CONFIRMADO: ['INICIAR'],
      EM_ANDAMENTO: ['FINALIZAR'],
      ATRASADO: ['INICIAR', 'CANCELAR'],
      FINALIZADO: [],
      CANCELADO: [],
    };
    return map[this.agendamento.status];
  }

  get actionLabel(): Record<QuickActionType, string> {
    return {
      CONFIRMAR: 'Confirmar',
      INICIAR: 'Iniciar',
      FINALIZAR: 'Finalizar',
      CANCELAR: 'Cancelar',
    };
  }

  formatTime(d: Date): string {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  onAction(action: QuickActionType, event: Event): void {
    event.stopPropagation();
    this.quickAction.emit({ id: this.agendamento.id, action });
  }

  onCardClick(): void {
    this.openModal.emit(this.agendamento.id);
  }
}
