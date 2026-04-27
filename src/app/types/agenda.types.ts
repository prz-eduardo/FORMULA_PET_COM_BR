// =============================================================================
// Agenda Inteligente Modular — PetSphere
// Shared types used by all agenda components and services
// =============================================================================

export type PartnerType = 'PETSHOP' | 'CLINIC' | 'SITTER' | 'HOTEL';

export type ViewMode = 'DAY' | 'WEEK' | 'TIMELINE' | 'LIST';

export type AgendaStatus =
  | 'AGENDADO'
  | 'CONFIRMADO'
  | 'EM_ANDAMENTO'
  | 'ATRASADO'
  | 'FINALIZADO'
  | 'CANCELADO';

export interface AgendaConfig {
  multiProfessional: boolean;
  allowOverlap: boolean;
  defaultDuration: number; // minutes
  servicesEnabled: boolean;
  viewModes: ViewMode[];
  workStart: number; // hour (8 = 08:00)
  workEnd: number;   // hour (20 = 20:00)
}

export interface Profissional {
  id: string;
  nome: string;
  avatarUrl?: string;
  especialidade?: string;
  ativo: boolean;
}

export interface Servico {
  id: string;
  nome: string;
  duracaoMin: number;
  preco?: number;
  cor?: string; // hex
}

export interface PetResumido {
  id: string;
  nome: string;
  especie: 'Cão' | 'Gato' | 'Outro';
  raca?: string;
  photoUrl?: string;
  alergias: string[];
  observacoes?: string;
  temMedicacao: boolean;
  temRestricao: boolean;
  temAlimentacaoEspecial: boolean;
  historicoRecente: HistoricoItem[];
  tutor: TutorResumido;
}

export interface TutorResumido {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
}

export interface HistoricoItem {
  data: Date;
  servico: string;
  profissional: string;
  obs?: string;
}

export interface Agendamento {
  id: string;
  parceiroId: string;
  pet: PetResumido;
  profissional: Profissional;
  servico: Servico;
  inicio: Date;
  fim: Date;
  status: AgendaStatus;
  observacoes?: string;
  recorrente: boolean;
  recorrenciaInfo?: string; // 'semanal', 'quinzenal', 'mensal'
  checkIn?: Date;
  checkOut?: Date; // for SITTER/HOTEL
  diaria?: boolean; // HOTEL mode
}

export interface AgendaFiltros {
  profissionalId?: string;
  servicoId?: string;
  status?: AgendaStatus[];
  especie?: string;
  search?: string;
}

export interface SlotInfo {
  hora: Date;
  profissionalId?: string;
}

export interface Parceiro {
  id: string;
  nome: string;
  tipo: PartnerType;
  logoUrl?: string;
}
