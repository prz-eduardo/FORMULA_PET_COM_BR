import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Agendamento, AgendaConfig, Profissional, SlotInfo } from '../../../../types/agenda.types';
import { AgendaCardComponent, QuickActionEvent } from '../agenda-card/agenda-card.component';

interface TimeHour {
  label: string;
  hour: number;
}

@Component({
  selector: 'app-agenda-timeline',
  standalone: true,
  imports: [CommonModule, AgendaCardComponent],
  templateUrl: './agenda-timeline.component.html',
  styleUrls: ['./agenda-timeline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaTimelineComponent {
  @Input() agendamentos: Agendamento[] = [];
  @Input() profissionais: Profissional[] = [];
  @Input() config!: AgendaConfig;
  @Input() selectedDate!: Date;
  @Output() slotClick = new EventEmitter<SlotInfo>();
  @Output() quickAction = new EventEmitter<QuickActionEvent>();
  @Output() openModal = new EventEmitter<string>();

  readonly PX_PER_HOUR = 120;

  get workStart(): number { return this.config?.workStart ?? 8; }
  get workEnd(): number   { return this.config?.workEnd ?? 19; }

  get hours(): TimeHour[] {
    const h: TimeHour[] = [];
    for (let i = this.workStart; i <= this.workEnd; i++) {
      h.push({ label: `${String(i).padStart(2, '0')}:00`, hour: i });
    }
    return h;
  }

  get totalMinutes(): number {
    return (this.workEnd - this.workStart) * 60;
  }

  get timelineWidth(): number {
    return (this.workEnd - this.workStart) * this.PX_PER_HOUR;
  }

  get profRows(): Profissional[] {
    return this.config?.multiProfessional ? this.profissionais : [this.profissionais[0]].filter(Boolean);
  }

  agendamentosForProf(profId: string): Agendamento[] {
    return this.agendamentos.filter(a => a.profissional.id === profId);
  }

  leftPx(a: Agendamento): string {
    const startMin = a.inicio.getHours() * 60 + a.inicio.getMinutes();
    const offset = startMin - this.workStart * 60;
    return Math.max(0, (offset / 60) * this.PX_PER_HOUR) + 'px';
  }

  widthPx(a: Agendamento): string {
    const dur = (a.fim.getTime() - a.inicio.getTime()) / 60000;
    return Math.max(60, (dur / 60) * this.PX_PER_HOUR) + 'px';
  }

  get nowLeftPx(): string | null {
    const now = new Date();
    if (now.toDateString() !== this.selectedDate?.toDateString()) return null;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const offset = nowMin - this.workStart * 60;
    if (offset < 0 || offset > this.totalMinutes) return null;
    return ((offset / 60) * this.PX_PER_HOUR) + 'px';
  }

  gapsForProf(profId: string): Array<{ leftPx: string; widthPx: string }> {
    const busy = this.agendamentosForProf(profId)
      .filter(a => a.status !== 'CANCELADO')
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

    const gaps: Array<{ leftPx: string; widthPx: string }> = [];
    let cursor = this.workStart * 60;
    const end = this.workEnd * 60;

    for (const a of busy) {
      const aStart = a.inicio.getHours() * 60 + a.inicio.getMinutes();
      if (aStart > cursor + 30) {
        const gapMin = aStart - cursor;
        gaps.push({
          leftPx: ((cursor - this.workStart * 60) / 60 * this.PX_PER_HOUR) + 'px',
          widthPx: (gapMin / 60 * this.PX_PER_HOUR) + 'px',
        });
      }
      const aEnd = a.fim.getHours() * 60 + a.fim.getMinutes();
      cursor = Math.max(cursor, aEnd);
    }

    if (cursor < end - 30) {
      gaps.push({
        leftPx: ((cursor - this.workStart * 60) / 60 * this.PX_PER_HOUR) + 'px',
        widthPx: ((end - cursor) / 60 * this.PX_PER_HOUR) + 'px',
      });
    }

    return gaps;
  }

  onSlotClick(prof: Profissional, hour: TimeHour): void {
    const hora = new Date(this.selectedDate);
    hora.setHours(hour.hour, 0, 0, 0);
    this.slotClick.emit({ hora, profissionalId: prof.id });
  }
}
