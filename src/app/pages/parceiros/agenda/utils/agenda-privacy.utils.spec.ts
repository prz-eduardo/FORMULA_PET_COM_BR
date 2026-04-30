import { Agendamento } from '../../../../types/agenda.types';
import { maskAgendamentoByScope, normalizeAgendamentoApi } from './agenda-privacy.utils';

describe('agenda privacy utils', () => {
  it('normalizes v2 datetime/snapshot fields', () => {
    const row = {
      id: 1,
      status: 'AGENDADO',
      inicio: '',
      fim: '',
      data_hora_inicio: '2026-04-28T10:00:00.000Z',
      data_hora_fim: '2026-04-28T11:00:00.000Z',
      cliente_nome_snapshot: 'Maria Silva',
      cliente_telefone_snapshot: '11999999999',
      pet_nome_snapshot: 'Luna',
    } as unknown as Agendamento;

    const normalized = normalizeAgendamentoApi(row);
    expect(normalized.inicio).toBe('2026-04-28T10:00:00.000Z');
    expect(normalized.fim).toBe('2026-04-28T11:00:00.000Z');
    expect(normalized.cliente_nome).toBe('Maria Silva');
    expect(normalized.pet_nome).toBe('Luna');
  });

  it('masks fields without permission', () => {
    const source = {
      id: 2,
      status: 'AGENDADO',
      inicio: '2026-04-28T10:00:00.000Z',
      fim: '2026-04-28T11:00:00.000Z',
      cliente_nome: 'Maria Silva',
      cliente_telefone: '11999999999',
      pet_nome: 'Luna',
    } as unknown as Agendamento;

    const masked = maskAgendamentoByScope(source, null);
    expect(masked.cliente_nome).toBe('Maria');
    expect(masked.cliente_telefone).toBeNull();
    expect(masked.pet_nome).toBeNull();
  });
});
