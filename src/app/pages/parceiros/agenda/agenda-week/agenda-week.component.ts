import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Agendamento } from '../../../../types/agenda.types';
import { AgendaCardComponent, QuickActionEvent } from '../agenda-card/agenda-card.component';
import { toDateString, getTime, toDate } from '../utils/date-helpers';

interface DayCol {
  date: Date;
  label: string;
  dayLabel: string;
  isToday: boolean;
  agendamentos: Agendamento[];
}

@Component({
  selector: 'app-agenda-week',
  standalone: true,
  imports: [CommonModule, AgendaCardComponent],
  templateUrl: './agenda-week.component.html',
  styleUrls: ['./agenda-week.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaWeekComponent {
  @Input() set selectedDate(d: Date) { this._selectedDate = d; this.buildWeek(); }
  @Input() set agendamentos(list: Agendamento[]) { this._agendamentos = list; this.buildWeek(); }
  @Output() daySelected = new EventEmitter<Date>();
  @Output() quickAction = new EventEmitter<QuickActionEvent>();
  @Output() openModal = new EventEmitter<string>();

  private _selectedDate = new Date();
  private _agendamentos: Agendamento[] = [];
  days: DayCol[] = [];

  private buildWeek(): void {
    const start = this.weekStart(this._selectedDate);
    this.days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start.getTime() + i * 86400000);
      const dayAgendamentos = this._agendamentos.filter(
        a => toDateString(a.inicio) === d.toDateString()
      ).sort((a, b) => getTime(a.inicio) - getTime(b.inicio));
      return {
        date: d,
        label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        dayLabel: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
        isToday: d.toDateString() === new Date().toDateString(),
        agendamentos: dayAgendamentos,
      };
    });
  }

  private weekStart(d: Date): Date {
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const s = new Date(d);
    s.setDate(d.getDate() + diff);
    s.setHours(0, 0, 0, 0);
    return s;
  }

  formatTime(d: Date | string): string {
    return toDate(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  asString(value: string | number): string {
    return String(value);
  }
}
