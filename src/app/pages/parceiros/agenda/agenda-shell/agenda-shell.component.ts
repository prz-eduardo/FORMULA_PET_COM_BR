import {
  Component, OnInit, signal, computed, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Agendamento, AgendaConfig, AgendaFiltros, AgendaStatus,
  PartnerType, Profissional, Servico, SlotInfo, ViewMode
} from '../../../../types/agenda.types';
import { ParceiroAuthService } from '../../../../services/parceiro-auth.service';
import { AgendaMockService } from '../services/agenda-mock.service';
import { AgendaConfigService } from '../services/agenda-config.service';
import { AgendaFiltersComponent } from '../agenda-filters/agenda-filters.component';
import { AgendaGridComponent } from '../agenda-grid/agenda-grid.component';
import { AgendaTimelineComponent } from '../agenda-timeline/agenda-timeline.component';
import { AgendaWeekComponent } from '../agenda-week/agenda-week.component';
import { AgendaListComponent } from '../agenda-list/agenda-list.component';
import { AgendaSidebarComponent } from '../agenda-sidebar/agenda-sidebar.component';
import { AgendaModalComponent } from '../agenda-modal/agenda-modal.component';

@Component({
  selector: 'app-agenda-shell',
  standalone: true,
  imports: [
    CommonModule,
    AgendaFiltersComponent,
    AgendaGridComponent,
    AgendaTimelineComponent,
    AgendaWeekComponent,
    AgendaListComponent,
    AgendaSidebarComponent,
    AgendaModalComponent,
  ],
  templateUrl: './agenda-shell.component.html',
  styleUrls: ['./agenda-shell.component.scss'],
})
export class AgendaShellComponent implements OnInit {

  // ── State ──────────────────────────────────────────────────────────────
  viewMode = signal<ViewMode>('DAY');
  selectedDate = signal<Date>(new Date());
  filters = signal<AgendaFiltros>({});
  sidebarOpen = signal(false);
  sidebarSlot = signal<SlotInfo | null>(null);
  modalAgendamentoId = signal<string | null>(null);

  // Raw agendamentos from mock
  rawAgendamentos = signal<Agendamento[]>([]);

  partnerType = signal<PartnerType>('PETSHOP');
  config = signal<AgendaConfig | null>(null);
  profissionais = signal<Profissional[]>([]);
  servicos = signal<Servico[]>([]);

  // ── Computed ───────────────────────────────────────────────────────────

  /** Auto-apply ATRASADO status when time has passed */
  agendamentos = computed<Agendamento[]>(() => {
    const now = new Date();
    return this.rawAgendamentos().map(a => {
      if (
        a.fim < now &&
        (a.status === 'AGENDADO' || a.status === 'CONFIRMADO')
      ) {
        return { ...a, status: 'ATRASADO' as AgendaStatus };
      }
      return a;
    });
  });

  filteredAgendamentos = computed<Agendamento[]>(() => {
    const f = this.filters();
    return this.agendamentos().filter(a => {
      if (f.profissionalId && a.profissional.id !== f.profissionalId) return false;
      if (f.servicoId && a.servico.id !== f.servicoId) return false;
      if (f.status?.length && !f.status.includes(a.status)) return false;
      if (f.search) {
        const q = f.search.toLowerCase();
        if (
          !a.pet.nome.toLowerCase().includes(q) &&
          !a.pet.tutor.nome.toLowerCase().includes(q) &&
          !a.servico.nome.toLowerCase().includes(q) &&
          !a.profissional.nome.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  });

  totalCount = computed(() => this.agendamentos().filter(a => a.status !== 'CANCELADO').length);
  atrasadosCount = computed(() => this.agendamentos().filter(a => a.status === 'ATRASADO').length);

  modalAgendamento = computed(() => {
    const id = this.modalAgendamentoId();
    if (!id) return null;
    return this.agendamentos().find(a => a.id === id) ?? null;
  });

  dateLabel = computed(() => {
    const d = this.selectedDate();
    if (this.viewMode() === 'WEEK') {
      const start = this.getWeekStart(d);
      const end = new Date(start.getTime() + 6 * 86400000);
      return `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    }
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  });

  isToday = computed(() => {
    const d = this.selectedDate();
    const t = new Date();
    return d.toDateString() === t.toDateString();
  });

  // ── Labels ─────────────────────────────────────────────────────────────
  readonly MODE_LABELS: Record<ViewMode, string> = {
    DAY: 'Dia',
    WEEK: 'Semana',
    TIMELINE: 'Timeline',
    LIST: 'Lista',
  };

  readonly ALL_MODES: ViewMode[] = ['DAY', 'WEEK', 'TIMELINE', 'LIST'];

  constructor(
    private auth: ParceiroAuthService,
    private mockSvc: AgendaMockService,
    private configSvc: AgendaConfigService,
  ) {
    // Re-generate mock when date or type changes
    effect(() => {
      const tipo = this.partnerType();
      const date = this.selectedDate();
      const cfg = this.configSvc.getConfig(tipo);
      this.config.set(cfg);
      this.profissionais.set(this.mockSvc.getProfissionais(tipo));
      this.servicos.set(this.mockSvc.getServicos(tipo));
      this.rawAgendamentos.set(this.mockSvc.generate(tipo, date));
    });
  }

  ngOnInit(): void {
    const parceiro = this.auth.getCurrentParceiro();
    if (parceiro) {
      this.partnerType.set(parceiro.tipo);
    }

    // On mobile default to LIST
    if (window.innerWidth < 768) {
      this.viewMode.set('LIST');
    }
  }

  // ── Navigation ──────────────────────────────────────────────────────────

  prevDate(): void {
    const d = new Date(this.selectedDate());
    const delta = this.viewMode() === 'WEEK' ? 7 : 1;
    d.setDate(d.getDate() - delta);
    this.selectedDate.set(d);
  }

  nextDate(): void {
    const d = new Date(this.selectedDate());
    const delta = this.viewMode() === 'WEEK' ? 7 : 1;
    d.setDate(d.getDate() + delta);
    this.selectedDate.set(d);
  }

  goToToday(): void {
    this.selectedDate.set(new Date());
  }

  setViewMode(m: ViewMode): void {
    this.viewMode.set(m);
  }

  // ── Filters ─────────────────────────────────────────────────────────────

  onFiltersChange(f: AgendaFiltros): void {
    this.filters.set(f);
  }

  // ── Sidebar (new agendamento) ────────────────────────────────────────────

  openSidebar(slot?: SlotInfo): void {
    this.sidebarSlot.set(slot ?? null);
    this.sidebarOpen.set(true);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
    this.sidebarSlot.set(null);
  }

  onAgendamentoSaved(novo: Agendamento): void {
    this.rawAgendamentos.set([...this.rawAgendamentos(), novo]);
    this.closeSidebar();
  }

  // ── Modal ───────────────────────────────────────────────────────────────

  openModal(id: string): void {
    this.modalAgendamentoId.set(id);
  }

  closeModal(): void {
    this.modalAgendamentoId.set(null);
  }

  // ── Quick actions ────────────────────────────────────────────────────────

  onQuickAction(evt: { id: string; action: string }): void {
    const nextStatus: Record<string, AgendaStatus> = {
      CONFIRMAR: 'CONFIRMADO',
      INICIAR: 'EM_ANDAMENTO',
      FINALIZAR: 'FINALIZADO',
      CANCELAR: 'CANCELADO',
    };
    const newStatus = nextStatus[evt.action];
    if (!newStatus) return;
    this.rawAgendamentos.set(
      this.rawAgendamentos().map(a =>
        a.id === evt.id ? { ...a, status: newStatus } : a
      )
    );
  }

  onStatusChanged(evt: { id: string; status: AgendaStatus }): void {
    this.rawAgendamentos.set(
      this.rawAgendamentos().map(a =>
        a.id === evt.id ? { ...a, status: evt.status } : a
      )
    );
  }

  // ── Week helper ─────────────────────────────────────────────────────────

  private getWeekStart(d: Date): Date {
    const day = d.getDay(); // 0=Sun
    const diff = (day === 0 ? -6 : 1) - day;
    const start = new Date(d);
    start.setDate(d.getDate() + diff);
    return start;
  }

  onDaySelected(d: Date): void {
    this.selectedDate.set(d);
    this.viewMode.set('DAY');
  }

  isViewAvailable(m: ViewMode): boolean {
    return this.config()?.viewModes.includes(m) ?? true;
  }
}
