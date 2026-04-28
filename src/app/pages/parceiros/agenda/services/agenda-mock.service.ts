import { Injectable } from '@angular/core';
import {
  Agendamento,
  AgendaStatus,
  PartnerType,
  PetResumido,
  Profissional,
  Servico,
  TutorResumido,
} from '../../../../types/agenda.types';
import { getTime } from '../utils/date-helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Static mock data pools
// ─────────────────────────────────────────────────────────────────────────────

const TUTORES: TutorResumido[] = [
  { id: 't1', nome: 'Ana Paula Silva', telefone: '(11) 99234-5678', email: 'ana@email.com' },
  { id: 't2', nome: 'Carlos Mendes', telefone: '(11) 98765-4321', email: 'carlos@email.com' },
  { id: 't3', nome: 'Fernanda Costa', telefone: '(21) 91234-0000', email: 'fe@email.com' },
  { id: 't4', nome: 'Ricardo Alves', telefone: '(11) 97654-9876' },
  { id: 't5', nome: 'Juliana Lima', telefone: '(11) 96543-2109', email: 'ju@email.com' },
  { id: 't6', nome: 'Marcos Oliveira', telefone: '(21) 95432-1098' },
  { id: 't7', nome: 'Patricia Santos', telefone: '(11) 94321-0987', email: 'pati@email.com' },
  { id: 't8', nome: 'Eduardo Rocha', telefone: '(11) 93210-0876' },
];

const PETS_POOL: Omit<PetResumido, 'tutor'>[] = [
  {
    id: 'p1', nome: 'Thor', especie: 'Cão', raca: 'Golden Retriever',
    alergias: ['Proteína de frango'], observacoes: 'Ansioso com secador', temMedicacao: false,
    temRestricao: false, temAlimentacaoEspecial: true,
    historicoRecente: [{ data: new Date(2026, 3, 10), servico: 'Banho e Tosa', profissional: 'Camila', obs: 'Cliente satisfeito' }],
  },
  {
    id: 'p2', nome: 'Mel', especie: 'Cão', raca: 'Poodle',
    alergias: [], observacoes: 'Dócil, gosta de festinha', temMedicacao: true,
    temRestricao: false, temAlimentacaoEspecial: false,
    historicoRecente: [{ data: new Date(2026, 3, 15), servico: 'Banho', profissional: 'André' }],
  },
  {
    id: 'p3', nome: 'Frida', especie: 'Gato', raca: 'Persa',
    alergias: ['Areia perfumada'], observacoes: 'Agressiva ao banho — usar luvas', temMedicacao: false,
    temRestricao: true, temAlimentacaoEspecial: false,
    historicoRecente: [],
  },
  {
    id: 'p4', nome: 'Rex', especie: 'Cão', raca: 'Pastor Alemão',
    alergias: [], observacoes: '', temMedicacao: false,
    temRestricao: false, temAlimentacaoEspecial: false,
    historicoRecente: [{ data: new Date(2026, 3, 20), servico: 'Tosa', profissional: 'Camila' }],
  },
  {
    id: 'p5', nome: 'Luna', especie: 'Cão', raca: 'Labrador',
    alergias: ['Proteína de peixe'], observacoes: 'Come demais — controlar', temMedicacao: true,
    temRestricao: false, temAlimentacaoEspecial: true,
    historicoRecente: [],
  },
  {
    id: 'p6', nome: 'Pipoca', especie: 'Gato', raca: 'SRD',
    alergias: [], observacoes: 'Muito tranquilo', temMedicacao: false,
    temRestricao: false, temAlimentacaoEspecial: false,
    historicoRecente: [{ data: new Date(2026, 3, 5), servico: 'Consulta', profissional: 'Dr. Bruno' }],
  },
  {
    id: 'p7', nome: 'Bob', especie: 'Cão', raca: 'Bulldog Inglês',
    alergias: [], observacoes: 'Braquicefálico — evitar estresse', temMedicacao: false,
    temRestricao: true, temAlimentacaoEspecial: false,
    historicoRecente: [],
  },
  {
    id: 'p8', nome: 'Coco', especie: 'Cão', raca: 'Yorkshire',
    alergias: [], observacoes: '', temMedicacao: false,
    temRestricao: false, temAlimentacaoEspecial: false,
    historicoRecente: [],
  },
];

function makePets(): PetResumido[] {
  return PETS_POOL.map((p, i) => ({ ...p, tutor: TUTORES[i % TUTORES.length] }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Services per partner type
// ─────────────────────────────────────────────────────────────────────────────

const PETSHOP_SERVICOS: Servico[] = [
  { id: 's1', nome: 'Banho', duracaoMin: 60, preco: 65, cor: '#0db8de' },
  { id: 's2', nome: 'Tosa', duracaoMin: 90, preco: 85, cor: '#7c3aed' },
  { id: 's3', nome: 'Banho + Tosa', duracaoMin: 120, preco: 130, cor: '#2563eb' },
  { id: 's4', nome: 'Hidratação', duracaoMin: 30, preco: 40, cor: '#10b981' },
  { id: 's5', nome: 'Tosa Higiênica', duracaoMin: 45, preco: 50, cor: '#f59e0b' },
];

const CLINIC_SERVICOS: Servico[] = [
  { id: 'c1', nome: 'Consulta', duracaoMin: 30, preco: 180, cor: '#0db8de' },
  { id: 'c2', nome: 'Retorno', duracaoMin: 20, preco: 90, cor: '#10b981' },
  { id: 'c3', nome: 'Vacina', duracaoMin: 15, preco: 120, cor: '#7c3aed' },
  { id: 'c4', nome: 'Emergência', duracaoMin: 60, preco: 350, cor: '#ef4444' },
  { id: 'c5', nome: 'Exame', duracaoMin: 45, preco: 200, cor: '#f59e0b' },
];

const SITTER_SERVICOS: Servico[] = [
  { id: 'st1', nome: 'Visita Diurna', duracaoMin: 60, preco: 80, cor: '#0db8de' },
  { id: 'st2', nome: 'Visita Noturna', duracaoMin: 90, preco: 120, cor: '#7c3aed' },
  { id: 'st3', nome: 'Passeio', duracaoMin: 45, preco: 60, cor: '#10b981' },
];

const HOTEL_SERVICOS: Servico[] = [
  { id: 'h1', nome: 'Hospedagem Diária', duracaoMin: 1440, preco: 150, cor: '#0db8de' },
  { id: 'h2', nome: 'Hospedagem Premium', duracaoMin: 1440, preco: 220, cor: '#7c3aed' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Profissionais per partner type
// ─────────────────────────────────────────────────────────────────────────────

const PETSHOP_PROFS: Profissional[] = [
  { id: 'pr1', nome: 'Camila Torres', especialidade: 'Tosadora', ativo: true },
  { id: 'pr2', nome: 'André Souza', especialidade: 'Banho', ativo: true },
  { id: 'pr3', nome: 'Beatriz Lima', especialidade: 'Tosadora', ativo: true },
  { id: 'pr4', nome: 'Diego Ferreira', especialidade: 'Banho + Tosa', ativo: true },
];

const CLINIC_PROFS: Profissional[] = [
  { id: 'v1', nome: 'Dr. Bruno Medeiros', especialidade: 'Clínica Geral', ativo: true },
  { id: 'v2', nome: 'Dra. Letícia Ramos', especialidade: 'Dermatologia', ativo: true },
];

const SITTER_PROFS: Profissional[] = [
  { id: 'si1', nome: 'Roberta Neves', especialidade: 'Pet Sitter', ativo: true },
];

const HOTEL_PROFS: Profissional[] = [
  { id: 'ho1', nome: 'Equipe Hotel', especialidade: 'Hospedagem', ativo: true },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function dateAt(base: Date, hour: number, minute = 0): Date {
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

let _idCounter = 1;
function uid(): string { return 'mock-' + (_idCounter++); }

const STATUS_WEIGHTS: { status: AgendaStatus; weight: number }[] = [
  { status: 'AGENDADO', weight: 30 },
  { status: 'CONFIRMADO', weight: 25 },
  { status: 'EM_ANDAMENTO', weight: 10 },
  { status: 'FINALIZADO', weight: 30 },
  { status: 'CANCELADO', weight: 3 },
  { status: 'ATRASADO', weight: 2 },
];

function randomStatus(): AgendaStatus {
  const total = STATUS_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  for (const { status, weight } of STATUS_WEIGHTS) {
    r -= weight;
    if (r <= 0) return status;
  }
  return 'AGENDADO';
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AgendaMockService {
  private pets = makePets();

  /** Generate mock agendamentos for a given date and partner type */
  generate(tipo: PartnerType, date: Date): Agendamento[] {
    _idCounter = 1;
    switch (tipo) {
      case 'PETSHOP': return this.generatePetshop(date);
      case 'CLINIC':  return this.generateClinic(date);
      case 'SITTER':  return this.generateSitter(date);
      case 'HOTEL':   return this.generateHotel(date);
    }
  }

  /** All mock pets — for autocomplete */
  getPets(): PetResumido[] {
    return this.pets;
  }

  getProfissionais(tipo: PartnerType): Profissional[] {
    return {
      PETSHOP: PETSHOP_PROFS,
      CLINIC: CLINIC_PROFS,
      SITTER: SITTER_PROFS,
      HOTEL: HOTEL_PROFS,
    }[tipo];
  }

  getServicos(tipo: PartnerType): Servico[] {
    return {
      PETSHOP: PETSHOP_SERVICOS,
      CLINIC: CLINIC_SERVICOS,
      SITTER: SITTER_SERVICOS,
      HOTEL: HOTEL_SERVICOS,
    }[tipo];
  }

  // ── PETSHOP ──────────────────────────────────────────────────────────────

  private generatePetshop(date: Date): Agendamento[] {
    const slots: Array<{ hour: number; min: number }> = [];
    for (let h = 8; h < 18; h++) {
      slots.push({ hour: h, min: 0 });
      slots.push({ hour: h, min: 30 });
    }

    const result: Agendamento[] = [];

    for (const prof of PETSHOP_PROFS) {
      // Each pro gets 5–6 agendamentos
      const count = 5 + Math.floor(Math.random() * 2);
      const usedSlots = new Set<number>();

      for (let i = 0; i < count; i++) {
        const availableSlots = slots.filter(s => !usedSlots.has(s.hour * 2 + (s.min ? 1 : 0)));
        if (!availableSlots.length) break;

        const slot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
        const slotKey = slot.hour * 2 + (slot.min ? 1 : 0);
        usedSlots.add(slotKey);

        const servico = pick(PETSHOP_SERVICOS);
        const inicio = dateAt(date, slot.hour, slot.min);
        const fim = new Date(inicio.getTime() + servico.duracaoMin * 60000);
        const now = new Date();

        let status: AgendaStatus = randomStatus();
        // Force ATRASADO if past time and not finished/cancelled
        if (fim < now && status !== 'FINALIZADO' && status !== 'CANCELADO') {
          status = Math.random() < 0.3 ? 'ATRASADO' : 'FINALIZADO';
        }

        result.push({
          id: uid(),
          parceiroId: 'mock-parceiro-1',
          pet: pick(this.pets),
          profissional: prof,
          servico,
          inicio,
          fim,
          status,
          observacoes: Math.random() < 0.3 ? 'Cliente pediu atenção especial' : undefined,
          recorrente: Math.random() < 0.2,
          recorrenciaInfo: Math.random() < 0.2 ? 'semanal' : undefined,
        });
      }
    }

    // Add 2 simulated conflicts (same prof, overlapping time)
    const firstProf = PETSHOP_PROFS[0];
    const conflictBase = dateAt(date, 10, 0);
    result.push({
      id: uid(),
      parceiroId: 'mock-parceiro-1',
      pet: this.pets[1],
      profissional: firstProf,
      servico: PETSHOP_SERVICOS[0],
      inicio: conflictBase,
      fim: new Date(conflictBase.getTime() + 60 * 60000),
      status: 'CONFIRMADO',
      recorrente: false,
    });

    return result.sort((a, b) => getTime(a.inicio) - getTime(b.inicio));
  }

  // ── CLINIC ──────────────────────────────────────────────────────────────

  private generateClinic(date: Date): Agendamento[] {
    const result: Agendamento[] = [];
    const slots = [8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 14, 14.5, 15, 15.5, 16, 16.5, 17];

    for (const prof of CLINIC_PROFS) {
      const count = 6 + Math.floor(Math.random() * 3);
      const used = new Set<number>();

      for (let i = 0; i < count; i++) {
        const available = slots.filter(s => !used.has(s));
        if (!available.length) break;
        const slot = available[Math.floor(Math.random() * available.length)];
        used.add(slot);

        const hour = Math.floor(slot);
        const min = slot % 1 === 0.5 ? 30 : 0;
        const servico = pick(CLINIC_SERVICOS);
        const inicio = dateAt(date, hour, min);
        const fim = new Date(inicio.getTime() + servico.duracaoMin * 60000);
        const now = new Date();

        let status: AgendaStatus = randomStatus();
        if (fim < now && status !== 'FINALIZADO' && status !== 'CANCELADO') {
          status = 'FINALIZADO';
        }

        result.push({
          id: uid(),
          parceiroId: 'mock-parceiro-1',
          pet: pick(this.pets),
          profissional: prof,
          servico,
          inicio,
          fim,
          status,
          recorrente: Math.random() < 0.15,
          recorrenciaInfo: Math.random() < 0.15 ? 'mensal' : undefined,
        });
      }
    }

    return result.sort((a, b) => getTime(a.inicio) - getTime(b.inicio));
  }

  // ── SITTER ──────────────────────────────────────────────────────────────

  private generateSitter(date: Date): Agendamento[] {
    const result: Agendamento[] = [];
    const visitSlots = [{ h: 8, m: 0 }, { h: 12, m: 0 }, { h: 16, m: 30 }, { h: 20, m: 0 }];
    const prof = SITTER_PROFS[0];

    for (const slot of visitSlots) {
      if (Math.random() < 0.7) {
        const servico = pick(SITTER_SERVICOS);
        const inicio = dateAt(date, slot.h, slot.m);
        const fim = new Date(inicio.getTime() + servico.duracaoMin * 60000);
        result.push({
          id: uid(),
          parceiroId: 'mock-parceiro-1',
          pet: pick(this.pets),
          profissional: prof,
          servico,
          inicio,
          fim,
          status: randomStatus(),
          recorrente: Math.random() < 0.4,
          recorrenciaInfo: 'semanal',
        });
      }
    }

    return result.sort((a, b) => getTime(a.inicio) - getTime(b.inicio));
  }

  // ── HOTEL ──────────────────────────────────────────────────────────────

  private generateHotel(date: Date): Agendamento[] {
    const result: Agendamento[] = [];
    const prof = HOTEL_PROFS[0];
    const servico = HOTEL_SERVICOS[0];
    const count = 5 + Math.floor(Math.random() * 4);

    for (let i = 0; i < count; i++) {
      const pet = this.pets[i % this.pets.length];
      const checkIn = dateAt(date, 10, 0);
      // stays 1–5 nights
      const nights = 1 + Math.floor(Math.random() * 4);
      const checkOut = new Date(checkIn.getTime() + nights * 24 * 60 * 60000);

      result.push({
        id: uid(),
        parceiroId: 'mock-parceiro-1',
        pet,
        profissional: prof,
        servico,
        inicio: checkIn,
        fim: checkOut,
        status: randomStatus(),
        recorrente: false,
        diaria: true,
        checkIn,
        checkOut,
      });
    }

    return result;
  }
}
