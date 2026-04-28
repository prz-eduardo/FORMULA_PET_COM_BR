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

export type TipoRecurso = 'INDIVIDUAL' | 'COMPARTILHADO';

export type RoleColaborador = 'master' | 'colaborador';

export interface AgendaConfig {
  multiProfessional: boolean;
  allowOverlap: boolean;
  defaultDuration: number; // minutes
  servicesEnabled: boolean;
  viewModes: ViewMode[];
  workStart: number; // hour (8 = 08:00)
  workEnd: number;   // hour (20 = 20:00)
}

export interface Colaborador {
  id: number;
  parceiroId: number;
  nome: string;
  email: string;
  role: RoleColaborador;
  ativo: boolean;
  parceiroNome?: string;
  created_at?: string;
  last_login_at?: string | null;
}

export interface Recurso {
  id: number;
  estabelecimentoId: number;
  nome: string;
  tipo: TipoRecurso;
  ownerColaboradorId?: number | null;
  ativo: boolean;
  criado_em: string;
  updated_at: string;
}

export interface PermissaoRecurso {
  id: number;
  recursoId: number;
  colaboradorId: number;
  podeVisualizar: boolean;
  podeCriar: boolean;
  podeEditar: boolean;
  podeCancelar: boolean;
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
  id: number | string; // Support both for backward compatibility
  estabelecimentoId?: number;
  parceiroId?: string; // Legacy
  recursoId?: number;
  criadoPor?: number;
  criado_por?: number; // Backend naming
  clienteNome?: string;
  cliente_nome?: string; // Backend naming
  clienteTelefone?: string | null;
  cliente_telefone?: string | null; // Backend naming
  petNome?: string | null;
  pet_nome?: string | null; // Backend naming
  inicio: Date | string;
  fim: Date | string;
  status: AgendaStatus;
  observacoes?: string | null;
  criado_em?: string;
  updated_at?: string;
  // Legacy/optional fields for compatibility with mock data
  pet?: PetResumido;
  profissional?: Profissional;
  servico?: Servico;
  recorrente?: boolean;
  recorrenciaInfo?: string;
  checkIn?: Date;
  checkOut?: Date;
  diaria?: boolean;
}

export interface AgendaFiltros {
  profissionalId?: string;
  servicoId?: string;
  status?: AgendaStatus[];
  especie?: string;
  search?: string;
  recursoId?: number;
  dataInicio?: string;
  dataFim?: string;
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

export interface SessionColaborador {
  colaborador: Colaborador;
  token: string;
  expiresAt: number;
}
