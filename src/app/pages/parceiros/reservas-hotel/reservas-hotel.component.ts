import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AgendaApiService,
  HotelLeitoRow,
  HotelReservaRow,
  HotelReservaStatus,
} from '../agenda/services/agenda-api.service';
import { SideDrawerComponent } from '../../../shared/side-drawer/side-drawer.component';

type PeriodoFiltro = 'todos' | 'hoje' | '7dias' | '30dias';
type AbaAtiva = 'reservas' | 'leitos';
type DrawerMode = 'create' | 'details' | 'create-leito';

@Component({
  selector: 'app-reservas-hotel',
  standalone: true,
  imports: [CommonModule, FormsModule, SideDrawerComponent],
  templateUrl: './reservas-hotel.component.html',
  styleUrls: ['./reservas-hotel.component.scss'],
})
export class ReservasHotelComponent implements OnInit {
  readonly statusOptions: Array<{ value: HotelReservaStatus | 'todos'; label: string }> = [
    { value: 'todos', label: 'Todos os status' },
    { value: 'confirmada', label: 'Confirmada' },
    { value: 'pendente', label: 'Pendente' },
    { value: 'checkin_hoje', label: 'Check-in hoje' },
    { value: 'em_hospedagem', label: 'Em hospedagem' },
    { value: 'checkout_concluido', label: 'Checkout concluido' },
    { value: 'cancelada', label: 'Cancelada' },
  ];

  readonly periodOptions: Array<{ value: PeriodoFiltro; label: string }> = [
    { value: 'todos', label: 'Qualquer periodo' },
    { value: 'hoje', label: 'Hoje' },
    { value: '7dias', label: 'Proximos 7 dias' },
    { value: '30dias', label: 'Proximos 30 dias' },
  ];

  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly reservas = signal<HotelReservaRow[]>([]);
  readonly leitos = signal<HotelLeitoRow[]>([]);
  readonly occupancyRate = signal(0);
  readonly checkInHojeCount = signal(0);
  readonly pendentesCount = signal(0);
  readonly confirmadasCount = signal(0);

  readonly activeTab = signal<AbaAtiva>('reservas');
  readonly filterStatus = signal<HotelReservaStatus | 'todos'>('todos');
  readonly filterPeriod = signal<PeriodoFiltro>('todos');
  readonly searchTerm = signal('');

  readonly drawerOpen = signal(false);
  readonly drawerMode = signal<DrawerMode>('details');
  readonly selectedReserva = signal<HotelReservaRow | null>(null);

  readonly draftTutor = signal('');
  readonly draftPet = signal('');
  readonly draftLeitoId = signal<number | null>(null);
  readonly draftCheckIn = signal('');
  readonly draftCheckOut = signal('');
  readonly draftObservacoes = signal('');
  readonly formError = signal<string | null>(null);
  readonly draftLeitoNome = signal('');
  readonly draftLeitoTipo = signal('Standard');
  readonly draftLeitoCapacidade = signal(1);
  readonly draftLeitoFotoUrl = signal('');
  readonly draftLeitoExibirVitrine = signal(false);
  readonly draftLeitoPrecoDiaria = signal<number | null>(null);

  readonly filteredReservas = computed(() => {
    const normalizedQuery = this.normalize(this.searchTerm());
    const status = this.filterStatus();
    const period = this.filterPeriod();
    const today = this.toDateOnly(new Date());

    return this.reservas().filter((reserva) => {
      if (status !== 'todos' && reserva.status !== status) return false;
      if (!this.matchesPeriod(reserva.check_in, period, today)) return false;
      if (!normalizedQuery) return true;

      const haystack = this.normalize(`${reserva.id} ${this.getTutorNome(reserva)} ${this.getPetNome(reserva)} ${reserva.leito_nome || ''} ${reserva.status}`);
      return haystack.includes(normalizedQuery);
    });
  });

  readonly leitosDisponiveisCount = computed(() => this.leitos().filter((leito) => !this.toBool(leito.ocupado)).length);

  constructor(private readonly agendaApi: AgendaApiService) {}

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  trackReserva(_: number, reserva: HotelReservaRow): number {
    return reserva.id;
  }

  trackLeito(_: number, leito: HotelLeitoRow): number {
    return leito.id;
  }

  setTab(tab: AbaAtiva): void {
    this.activeTab.set(tab);
  }

  clearFilters(): void {
    this.filterStatus.set('todos');
    this.filterPeriod.set('todos');
    this.searchTerm.set('');
  }

  openCreateDrawer(): void {
    this.drawerMode.set('create');
    this.selectedReserva.set(null);
    this.formError.set(null);
    this.draftTutor.set('');
    this.draftPet.set('');
    this.draftLeitoId.set(this.leitos()[0]?.id ?? null);
    this.draftCheckIn.set('');
    this.draftCheckOut.set('');
    this.draftObservacoes.set('');
    this.drawerOpen.set(true);
  }

  openCreateLeitoDrawer(): void {
    this.drawerMode.set('create-leito');
    this.formError.set(null);
    this.draftLeitoNome.set('');
    this.draftLeitoTipo.set('Standard');
    this.draftLeitoCapacidade.set(1);
    this.draftLeitoFotoUrl.set('');
    this.draftLeitoExibirVitrine.set(false);
    this.draftLeitoPrecoDiaria.set(null);
    this.drawerOpen.set(true);
  }

  async openDetailsDrawer(reserva: HotelReservaRow): Promise<void> {
    this.drawerMode.set('details');
    try {
      const full = await this.agendaApi.getHotelReserva(reserva.id);
      this.selectedReserva.set(full || reserva);
    } catch {
      this.selectedReserva.set(reserva);
    }
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  async saveMockReserva(): Promise<void> {
    const tutorNome = this.draftTutor().trim();
    const petNome = this.draftPet().trim();
    const checkIn = this.draftCheckIn();
    const checkOut = this.draftCheckOut();

    if (!tutorNome || !petNome || !checkIn || !checkOut) {
      this.formError.set('Preencha tutor, pet e periodo.');
      return;
    }

    if (new Date(checkOut) < new Date(checkIn)) {
      this.formError.set('Check-out deve ser maior ou igual ao check-in.');
      return;
    }

    try {
      this.saving.set(true);
      this.formError.set(null);
      const nights = Math.max(1, this.diffDays(checkIn, checkOut));
      const created = await this.agendaApi.createHotelReserva({
        leito_id: this.draftLeitoId() || null,
        cliente_nome_snapshot: tutorNome,
        pet_nome_snapshot: petNome,
        check_in: `${checkIn}T12:00:00`,
        check_out: `${checkOut}T12:00:00`,
        status: 'pendente',
        valor_total: nights * 135,
        observacoes: this.draftObservacoes().trim() || null,
      });

      if (!created) {
        this.formError.set('Nao foi possivel criar a reserva.');
        return;
      }

      await this.reload();
      this.drawerMode.set('details');
      this.selectedReserva.set(created);
    } catch (err: unknown) {
      const msg = (err as { error?: { error?: string } })?.error?.error || 'Falha ao salvar reserva';
      this.formError.set(msg);
    } finally {
      this.saving.set(false);
    }
  }

  async saveLeito(): Promise<void> {
    const nome = this.draftLeitoNome().trim();
    const tipo = this.draftLeitoTipo().trim() || 'Standard';
    const capacidade = Number(this.draftLeitoCapacidade() || 1);
    const fotoUrl = this.draftLeitoFotoUrl().trim();
    const exibir = this.draftLeitoExibirVitrine();
    const preco = this.draftLeitoPrecoDiaria();

    if (!nome) {
      this.formError.set('Informe o nome do leito.');
      return;
    }
    if (!Number.isFinite(capacidade) || capacidade < 1) {
      this.formError.set('Capacidade inválida.');
      return;
    }
    if (exibir && (preco == null || !Number.isFinite(preco) || Number(preco) < 0)) {
      this.formError.set('Defina um preco_diaria valido para exibir na vitrine.');
      return;
    }

    try {
      this.saving.set(true);
      this.formError.set(null);
      const created = await this.agendaApi.createHotelLeito({
        nome,
        tipo,
        capacidade,
        foto_url: fotoUrl || null,
        exibir_na_vitrine: exibir,
        preco_diaria: exibir ? Number(preco) : null,
      });
      if (!created) {
        this.formError.set('Nao foi possivel cadastrar o leito.');
        return;
      }
      await this.reload();
      this.drawerOpen.set(false);
    } catch (err: unknown) {
      const msg = (err as { error?: { error?: string } })?.error?.error || 'Falha ao cadastrar leito';
      this.formError.set(msg);
    } finally {
      this.saving.set(false);
    }
  }

  statusLabel(status: HotelReservaStatus): string {
    switch (status) {
      case 'confirmada':
        return 'Confirmada';
      case 'pendente':
        return 'Pendente';
      case 'checkin_hoje':
        return 'Check-in hoje';
      case 'em_hospedagem':
        return 'Em hospedagem';
      case 'checkout_concluido':
        return 'Checkout concluido';
      case 'cancelada':
        return 'Cancelada';
      default:
        return status;
    }
  }

  formatDate(dateIso: string): string {
    const d = new Date(dateIso);
    return Number.isNaN(d.getTime())
      ? dateIso
      : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  getTutorNome(reserva: HotelReservaRow): string {
    return reserva.cliente_nome_snapshot || 'Cliente';
  }

  getPetNome(reserva: HotelReservaRow): string {
    return reserva.pet_nome_snapshot || '-';
  }

  getAcomodacaoNome(reserva: HotelReservaRow): string {
    if (reserva.leito_nome) return reserva.leito_nome;
    if (reserva.leito_tipo) return `Leito ${reserva.leito_tipo}`;
    return 'Nao vinculado';
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const [reservas, leitos, resumo] = await Promise.all([
        this.agendaApi.listHotelReservas(),
        this.agendaApi.listHotelLeitos(),
        this.agendaApi.getHotelResumo(),
      ]);
      this.reservas.set(reservas);
      this.leitos.set(leitos);
      this.occupancyRate.set(Number(resumo?.ocupacao_percentual || 0));
      this.checkInHojeCount.set(Number(resumo?.checkins_hoje || 0));
      this.pendentesCount.set(Number(resumo?.reservas_pendentes || 0));
      this.confirmadasCount.set(Number(resumo?.reservas_confirmadas || 0));
    } catch {
      this.loadError.set('Nao foi possivel carregar dados de reservas do hotel.');
      this.reservas.set([]);
      this.leitos.set([]);
      this.occupancyRate.set(0);
      this.checkInHojeCount.set(0);
      this.pendentesCount.set(0);
      this.confirmadasCount.set(0);
    } finally {
      this.loading.set(false);
    }
  }

  private matchesPeriod(checkInIso: string, period: PeriodoFiltro, today: Date): boolean {
    if (period === 'todos') return true;
    const checkInDate = this.toDateOnly(new Date(checkInIso));
    if (period === 'hoje') return checkInDate.getTime() === today.getTime();

    const limit = new Date(today);
    limit.setDate(limit.getDate() + (period === '7dias' ? 7 : 30));
    return checkInDate >= today && checkInDate <= limit;
  }

  private toDateOnly(date: Date): Date {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  private diffDays(startIso: string, endIso: string): number {
    const start = new Date(`${startIso}T00:00:00`).getTime();
    const end = new Date(`${endIso}T00:00:00`).getTime();
    return Math.max(1, Math.ceil((end - start) / 86400000));
  }

  private normalize(value: string): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private toBool(value: unknown): boolean {
    return value === true || value === 1 || value === '1';
  }
}
