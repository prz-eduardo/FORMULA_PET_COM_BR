import {
  Component, Input, Output, EventEmitter, OnInit, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Agendamento, AgendaConfig, AgendaStatus,
  PetResumido, Profissional, Servico, SlotInfo
} from '../../../../types/agenda.types';
import { AgendaMockService } from '../services/agenda-mock.service';
import { getTime } from '../utils/date-helpers';

@Component({
  selector: 'app-agenda-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agenda-sidebar.component.html',
  styleUrls: ['./agenda-sidebar.component.scss'],
})
export class AgendaSidebarComponent implements OnInit {
  @Input() slot: SlotInfo | null = null;
  @Input() profissionais: Profissional[] = [];
  @Input() servicos: Servico[] = [];
  @Input() config!: AgendaConfig;
  @Input() existingAgendamentos: Agendamento[] = [];
  @Output() save = new EventEmitter<Agendamento>();
  @Output() close = new EventEmitter<void>();

  // Form fields
  searchPet = signal('');
  selectedPet = signal<PetResumido | null>(null);
  selectedProfId = signal('');
  selectedServicoId = signal('');
  dateStr = signal('');
  timeStr = signal('');
  durMin = signal(60);
  obs = signal('');

  allPets = signal<PetResumido[]>([]);
  filteredPets = computed(() => {
    const q = this.searchPet().toLowerCase();
    if (!q) return [];
    return this.allPets().filter(p =>
      p.nome.toLowerCase().includes(q) || p.tutor.nome.toLowerCase().includes(q)
    ).slice(0, 6);
  });

  sugeridoHorario = computed(() => {
    const now = new Date();
    const busy = this.existingAgendamentos
      .filter(a => a.status !== 'CANCELADO')
      .sort((a, b) => getTime(a.inicio) - getTime(b.inicio));

    for (let h = Math.max(now.getHours(), this.config?.workStart ?? 8); h < (this.config?.workEnd ?? 19); h++) {
      for (const m of [0, 30]) {
        const candidate = new Date();
        candidate.setHours(h, m, 0, 0);
        if (candidate <= now) continue;
        const dur = this.durMin() * 60000;
        const conflict = busy.find(
          a => a.inicio < new Date(candidate.getTime() + dur) && a.fim > candidate
        );
        if (!conflict) {
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }
      }
    }
    return null;
  });

  showPetDropdown = signal(false);

  constructor(private mock: AgendaMockService) {}

  ngOnInit(): void {
    this.allPets.set(this.mock.getPets());

    // Pre-fill from slot
    if (this.slot) {
      const d = this.slot.hora;
      this.dateStr.set(d.toISOString().substring(0, 10));
      this.timeStr.set(
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      );
      if (this.slot.profissionalId) {
        this.selectedProfId.set(this.slot.profissionalId);
      }
    } else {
      const today = new Date();
      this.dateStr.set(today.toISOString().substring(0, 10));
      this.timeStr.set(this.sugeridoHorario() ?? '08:00');
    }

    if (this.servicos.length) {
      this.selectedServicoId.set(this.servicos[0].id);
      this.durMin.set(this.servicos[0].duracaoMin);
    }

    if (this.profissionais.length && !this.selectedProfId()) {
      this.selectedProfId.set(this.profissionais[0].id);
    }
  }

  selectPet(pet: PetResumido): void {
    this.selectedPet.set(pet);
    this.searchPet.set(pet.nome);
    this.showPetDropdown.set(false);
  }

  clearPet(): void {
    this.selectedPet.set(null);
    this.searchPet.set('');
  }

  onServicoChange(id: string): void {
    this.selectedServicoId.set(id);
    const s = this.servicos.find(s => s.id === id);
    if (s) this.durMin.set(s.duracaoMin);
  }

  useSugestao(): void {
    if (this.sugeridoHorario()) {
      this.timeStr.set(this.sugeridoHorario()!);
    }
  }

  getSelectedServico(): Servico | null {
    return this.servicos.find(s => s.id === this.selectedServicoId()) ?? null;
  }

  getSelectedProfissional(): Profissional | null {
    return this.profissionais.find(p => p.id === this.selectedProfId()) ?? null;
  }

  canSave(): boolean {
    return !!(this.selectedPet() && this.selectedProfId() && this.selectedServicoId() && this.dateStr() && this.timeStr());
  }

  onSave(): void {
    if (!this.canSave()) return;

    const [year, month, day] = this.dateStr().split('-').map(Number);
    const [hour, min] = this.timeStr().split(':').map(Number);

    const inicio = new Date(year, month - 1, day, hour, min, 0, 0);
    const fim = new Date(inicio.getTime() + this.durMin() * 60000);

    const prof = this.getSelectedProfissional();
    const serv = this.getSelectedServico();
    if (!prof || !serv) return;

    const novo: Agendamento = {
      id: 'new-' + Date.now(),
      parceiroId: 'mock-parceiro-1',
      pet: this.selectedPet()!,
      profissional: prof,
      servico: serv,
      inicio,
      fim,
      status: 'AGENDADO' as AgendaStatus,
      observacoes: this.obs() || undefined,
      recorrente: false,
    };

    this.save.emit(novo);
  }
}
