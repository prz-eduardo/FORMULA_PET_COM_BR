import { Agendamento, EscopoPermissaoDados } from '../../../../types/agenda.types';

const WEIGHT: Record<EscopoPermissaoDados, number> = {
  dados_basicos: 1,
  pets: 2,
  completo: 3,
};

export function normalizeAgendamentoApi(a: Agendamento): Agendamento {
  return {
    ...a,
    inicio: a.data_hora_inicio || a.inicio,
    fim: a.data_hora_fim || a.fim,
    cliente_nome: a.cliente_nome || a.cliente_nome_snapshot || null,
    cliente_telefone: a.cliente_telefone || a.cliente_telefone_snapshot || null,
    pet_nome: a.pet_nome || a.pet_nome_snapshot || null,
  };
}

export function maskAgendamentoByScope(
  agendamento: Agendamento,
  scope: EscopoPermissaoDados | null | undefined
): Agendamento {
  const output = { ...agendamento };
  const currentWeight = scope ? WEIGHT[scope] : 0;
  if (currentWeight < 1) {
    output.cliente_nome = output.cliente_nome ? output.cliente_nome.split(' ')[0] : output.cliente_nome;
    output.cliente_telefone = null;
    output.pet_nome = null;
  } else if (currentWeight < 2) {
    output.pet_nome = null;
  }
  return output;
}
