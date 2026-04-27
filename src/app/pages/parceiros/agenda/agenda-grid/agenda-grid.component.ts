import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy, computed, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Agendamento, AgendaConfig, Profissional, SlotInfo } from '../../../../types/agenda.types';
import { AgendaCardComponent, QuickActionEvent } from '../agenda-card/agenda-card.component';

interface TimeSlot {
  label: string;   // '08:00'
  hour: number;
  minute: number;
}

@Component({
  selector: 'app-agenda-grid',
  standalone: true,
  imports: [CommonModule, AgendaCardComponent],
  templateUrl: './agenda-grid.component.html',
  styleUrls: ['./agenda-grid.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaGridComponent {
  @Input() agendamentos: Agendamento[] = [];
  @Input() profissionais: Profissional[] = [];
  @Input() config!: AgendaConfig;
  @Input() selectedDate!: Date;
  @Output() slotClick = new EventEmitter<SlotInfo>();
  @Output() quickAction = new EventEmitter<QuickActionEvent>();
  @Output() openModal = new EventEmitter<string>();

  readonly SLOT_HEIGHT_PX = 60; // pixels per 30 min slot

  get timeSlots(): TimeSlot[] {
    const start = this.config?.workStart ?? 8;
    const end = this.config?.workEnd ?? 19;
    const slots: TimeSlot[] = [];
    for (let h = start; h < end; h++) {
      slots.push({ label: `${String(h).padStart(2, '0')}:00`, hour: h, minute: 0 });
      slots.push({ label: `${String(h).padStart(2, '0')}:30`, hour: h, minute: 30 });
    }
    return slots;
  }

  get totalMinutes(): number {
    const start = this.config?.workStart ?? 8;
    const end = this.config?.workEnd ?? 19;
    return (end - start) * 60;
  }

  get gridHeight(): number {
    return this.timeSlots.length * this.SLOT_HEIGHT_PX;
  }

  get profCols(): Profissional[] {
    return this.config?.multiProfessional ? this.profissionais : [this.profissionais[0]].filter(Boolean);
  }

  agendamentosForProf(profId: string): Agendamento[] {
    return this.agendamentos.filter(a => a.profissional.id === profId);
  }

  topPercent(a: Agendamento): string {
    const start = (this.config?.workStart ?? 8) * 60;
    const startMin = a.inicio.getHours() * 60 + a.inicio.getMinutes();
    const offset = Math.max(0, startMin - start);
    return ((offset / this.totalMinutes) * 100).toFixed(2) + '%';
  }

  heightPercent(a: Agendamento): string {
    const dur = (a.fim.getTime() - a.inicio.getTime()) / 60000;
    return ((Math.min(dur, this.totalMinutes) / this.totalMinutes) * 100).toFixed(2) + '%';
  }

  get nowLineTop(): string | null {
    const now = new Date();
    if (now.toDateString() !== this.selectedDate?.toDateString()) return null;
    const start = (this.config?.workStart ?? 8) * 60;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const offset = nowMin - start;
    if (offset < 0 || offset > this.totalMinutes) return null;
    return ((offset / this.totalMinutes) * 100).toFixed(2) + '%';
  }

  onSlotClick(prof: Profissional, slot: TimeSlot): void {
    const hora = new Date(this.selectedDate);
    hora.setHours(slot.hour, slot.minute, 0, 0);
    this.slotClick.emit({ hora, profissionalId: prof.id });
  }
}
