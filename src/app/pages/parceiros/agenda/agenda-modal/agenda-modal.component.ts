import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Agendamento, AgendaStatus } from '../../../../types/agenda.types';
import { getTime, toDate } from '../utils/date-helpers';

interface StatusStep {
  status: AgendaStatus;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-agenda-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './agenda-modal.component.html',
  styleUrls: ['./agenda-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaModalComponent {
  @Input() agendamento!: Agendamento;
  @Output() close = new EventEmitter<void>();
  @Output() statusChanged = new EventEmitter<{ id: string; status: AgendaStatus }>();

  readonly STEPS: StatusStep[] = [
    { status: 'AGENDADO',    label: 'Agendado',    icon: '📅' },
    { status: 'CONFIRMADO',  label: 'Confirmado',  icon: '✅' },
    { status: 'EM_ANDAMENTO', label: 'Em andamento', icon: '▶️' },
    { status: 'FINALIZADO',  label: 'Finalizado',  icon: '🏁' },
  ];

  readonly STATUS_LABELS: Record<AgendaStatus, string> = {
    AGENDADO: 'Agendado',
    CONFIRMADO: 'Confirmado',
    EM_ANDAMENTO: 'Em andamento',
    ATRASADO: 'Atrasado',
    FINALIZADO: 'Finalizado',
    CANCELADO: 'Cancelado',
  };

  get currentStepIndex(): number {
    return this.STEPS.findIndex(s => s.status === this.agendamento.status);
  }

  isStepDone(s: StatusStep): boolean {
    const i = this.STEPS.findIndex(x => x.status === s.status);
    return i < this.currentStepIndex;
  }

  isStepActive(s: StatusStep): boolean {
    return s.status === this.agendamento.status;
  }

  get nextStatus(): AgendaStatus | null {
    const next: Partial<Record<AgendaStatus, AgendaStatus>> = {
      AGENDADO: 'CONFIRMADO',
      CONFIRMADO: 'EM_ANDAMENTO',
      EM_ANDAMENTO: 'FINALIZADO',
      ATRASADO: 'EM_ANDAMENTO',
    };
    return next[this.agendamento.status] ?? null;
  }

  get nextStatusLabel(): string | null {
    const ns = this.nextStatus;
    return ns ? this.STATUS_LABELS[ns] : null;
  }

  advanceStatus(): void {
    const ns = this.nextStatus;
    if (ns) this.statusChanged.emit({ id: String(this.agendamento.id), status: ns });
  }

  cancelAgendamento(): void {
    this.statusChanged.emit({ id: String(this.agendamento.id), status: 'CANCELADO' });
    this.close.emit();
  }

  formatDateTime(d: Date | string): string {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatTime(d: Date | string): string {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  get duration(): number {
    return Math.round((getTime(this.agendamento.fim) - getTime(this.agendamento.inicio)) / 60000);
  }
}
