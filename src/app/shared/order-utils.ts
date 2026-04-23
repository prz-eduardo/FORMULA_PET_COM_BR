export function formatCurrency(value: number | string | null | undefined): string {
  const v = Number(value || 0) || 0;
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  } catch (e) {
    return `R$ ${v.toFixed(2)}`;
  }
}

export function extractItems(order: any): any[] {
  if (!order) return [];
  let items: any = order.itens || order.items || order.raw_snapshot?.input?.itens || order.raw_snapshot?.itens || order.raw_snapshot?.input?.items || [];
  if (!Array.isArray(items)) return [];
  return items.map((it: any) => {
    const quantidade = Number(it.quantidade ?? it.qtd ?? it.qty ?? 1) || 1;
    const preco_unit = Number(it.preco_unit ?? it.preco ?? it.valor_unitario ?? it.valor ?? it.price ?? 0) || 0;
    const subtotal = Number(it.subtotal ?? (preco_unit * quantidade)) || (preco_unit * quantidade);
    return {
      ...it,
      quantidade,
      preco_unit,
      subtotal
    };
  });
}

export function extractCliente(o: any) {
  const top = {
    nome: o?.cliente_nome ?? null,
    email: o?.cliente_email ?? null,
    cpf: o?.cliente_cpf ?? null,
    id: o?.cliente_id ?? null,
  };
  const rs = o?.raw_snapshot || {};
  // prefer a top-level cliente object, then snapshot candidates
  const candidate = o?.cliente || rs?.cliente || rs?.customer || rs?.input?.cliente || rs?.input?.customer || rs?.input?.cliente_dados || rs?.input?.dados_cliente || rs?.input?.user || rs?.user || {};
  const rsNome = rs?.input?.cliente_nome || rs?.cliente_nome || rs?.input?.nome || rs?.nome || null;
  const rsEmail = rs?.input?.cliente_email || rs?.cliente_email || rs?.input?.email || rs?.email || null;
  const rsCpf = rs?.input?.cliente_cpf || rs?.cliente_cpf || rs?.input?.cpf || rs?.cpf || null;
  const rp = o?.raw_payment || {};
  const payer = rp?.payer || rp?.pagador || rp?.customer || {};
  const payerFirst = payer.first_name || payer.given_name || null;
  const payerLast = payer.last_name || payer.surname || null;
  const payerName = payer.name || payer.full_name || [payerFirst, payerLast].filter(Boolean).join(' ').trim() || null;
  const foto = o?.cliente?.foto || o?.cliente_foto || candidate.foto || null;
  const telefone = o?.cliente?.telefone || o?.telefone || o?.cliente?.telefone_principal || candidate.telefone || candidate.phone || null;
  return {
    nome: top.nome || candidate.nome || candidate.name || rsNome || payerName || null,
    email: top.email || candidate.email || rsEmail || payer.email || null,
    cpf: top.cpf || candidate.cpf || candidate.documento || candidate.document || candidate.tax_id || rsCpf || payer.cpf || payer.document || payer.tax_id || null,
    id: top.id || candidate.id || null,
    foto,
    telefone,
  };
}

export function extractShipping(o: any) {
  // Corrigido para funcionar com o JSON fornecido
  const endereco_entrega: any = o.endereco_entrega;
  const tipo: any = endereco_entrega?.tipo;
  const isRetirada: boolean = tipo === 'retirada_loja';
  const freteInfo = o.raw_shipping?.frete || o.raw_shipping || {};
  const frete_valor: any = freteInfo.valor ?? o.frete_valor ?? endereco_entrega?.valor_frete ?? 0;

  if (isRetirada) {
    // Se for retirada, tenta pegar endereço da loja se existir
    const endereco_loja = endereco_entrega?.endereco_loja || {};
    return {
      endereco_loja: {
        cep: endereco_loja.cep || null,
        cidade: endereco_loja.cidade || null,
        estado: endereco_loja.estado || null,
        logradouro: endereco_loja.logradouro || endereco_loja.observacao || null,
      },
      valor_frete: frete_valor,
      tipo: tipo
    };
  } else {
    // Entrega normal: prioriza endereco_entrega.endereco_cliente se existir, senão pega direto de endereco_entrega
    const ec = endereco_entrega?.endereco_cliente || endereco_entrega || {};
    return {
      endereco_cliente: {
        cep: ec.cep || null,
        cidade: ec.cidade || null,
        estado: ec.estado || null,
        logradouro: ec.logradouro || null,
        numero: ec.numero || null,
        bairro: ec.bairro || null,
        complemento: ec.complemento || null,
        nome: ec.nome || null,
        telefone: ec.telefone || null
      },
      valor_frete: frete_valor,
      tipo: tipo,
      modalidade_de_envio: freteInfo.nome || null,
      prazo_dias: freteInfo.prazo_dias || null,
      condigo_rastreamento: freteInfo.codigo_rastreamento || "não implementado"
    };
  }
}

export function extractTotals(o: any) {
  if (!o) return { items: 0, frete: 0, desconto: 0, total: 0 };
  const t = o.totals || o.raw_snapshot?.input?.totais || o.raw_snapshot?.totais || {};
  const items = Number(t.items_total ?? t.items ?? o.total_bruto ?? o.total_liquido ?? 0) || 0;
  const frete = Number(t.frete_total ?? t.shipping ?? o.frete_valor ?? 0) || 0;
  const desconto = Number(t.desconto_total ?? t.discount ?? o.desconto_total ?? 0) || 0;
  const total = Number(t.total ?? o.total ?? o.total_liquido ?? 0) || 0;
  return { items, frete, desconto, total };
}

export function normalizeOrder(o: any) {
  if (!o) return o;
  const normalized: any = { ...o };
  const rs = normalized.raw_snapshot || {};

  // canonical id
  normalized.id = normalized.id ?? normalized.pedido_id ?? normalized.order_id ?? null;

  // canonical created date
  normalized.created_at = normalized.created_at ?? normalized.createdAt ?? normalized.created ?? null;

  // canonical items array
  normalized.itens = normalized.itens || normalized.items || normalized.order_items || rs?.input?.itens || rs?.itens || rs?.input?.items || [];

  // canonical address -> build a resilient endereco_entrega envelope with backward compatibility
  (function buildEndereco() {
    const a = normalized.endereco_entrega || normalized.shipping_address || rs?.input?.entrega || rs?.input?.endereco_entrega || normalized.endereco || normalized.raw_shipping || {};
    const get = (obj: any, ...keys: string[]) => {
      for (const k of keys) {
        if (obj && (obj[k] !== undefined && obj[k] !== null)) return obj[k];
        const kl = k.toLowerCase();
        if (obj && (obj[kl] !== undefined && obj[kl] !== null)) return obj[kl];
      }
      return null;
    };

    // infer type (prefer explicit fields)
    let tipoRaw = get(a, 'tipo', 'type', 'shipping_type', 'method');
    let tipo = tipoRaw ? String(tipoRaw).toLowerCase() : null;
    if (tipo === 'pickup' || tipo === 'retirada' || tipo === 'store_pickup') tipo = 'retirada_loja';
    else if (tipo && tipo.indexOf('sedex') >= 0) tipo = 'sedex';
    else if (tipo && tipo.indexOf('pac') >= 0) tipo = 'pac';
    else if (tipo && tipo.indexOf('express') >= 0) tipo = 'express_local';
    if (!tipo) {
      if (a && (a.endereco_loja || a.loja || a.store_address || a.observacao)) tipo = 'retirada_loja';
      else tipo = 'entrega';
    }

    const endereco_loja = tipo === 'retirada_loja' ? {
      logradouro: get(a, 'observacao', 'logradouro', 'address', 'store_address', 'endereco'),
      numero: get(a, 'numero', 'number'),
      complemento: get(a, 'complemento', 'complement', 'address_line_2', 'address2') || get(a, 'observacao'),
      bairro: get(a, 'bairro', 'neighborhood'),
      cidade: get(a, 'cidade', 'city', 'store_city'),
      estado: get(a, 'estado', 'state', 'store_state'),
      cep: get(a, 'cep', 'zip', 'postal_code'),
      telefone: get(a, 'telefone', 'phone'),
      nome: get(a, 'nome', 'name'),
      observacao: get(a, 'observacao', 'notes') || get(a, 'observacao')
    } : null;

    const endereco_cliente = tipo !== 'retirada_loja' ? {
      cep: get(a, 'cep', 'zip', 'postal_code'),
      logradouro: get(a, 'logradouro', 'street', 'address', 'address_line_1'),
      numero: get(a, 'numero', 'number'),
      bairro: get(a, 'bairro', 'neighborhood'),
      cidade: get(a, 'cidade', 'city'),
      estado: get(a, 'estado', 'state'),
      complemento: get(a, 'complemento', 'complement', 'address_line_2', 'address2'),
      nome: get(a, 'nome', 'name', 'recipient'),
      telefone: get(a, 'telefone', 'phone')
    } : null;

    const valor_frete = Number(normalized.frete_valor ?? normalized.frete ?? rs?.frete_valor ?? rs?.valor ?? 0) || 0;
    const prazo_dias = Number(normalized.prazo_dias ?? rs?.prazo_dias ?? rs?.prazo ?? 0) || 0;

    const descricao_tipo = tipo === 'retirada_loja' ? 'Retirar na loja'
      : tipo === 'pac' ? 'PAC (estimativa)'
      : tipo === 'sedex' ? 'SEDEX (estimativa)'
      : tipo === 'express_local' ? 'Entrega Express (estimativa)'
      : 'Entrega';

    // build canonical envelope and keep legacy flat fields for compatibility
    normalized.endereco_entrega = {
      tipo,
      descricao_tipo,
      endereco_loja,
      endereco_cliente,
      valor_frete,
      prazo_dias,
      raw: a,
      logradouro: (endereco_cliente && endereco_cliente.logradouro) || (endereco_loja && endereco_loja.logradouro) || get(a, 'logradouro', 'street', 'address') || null,
      numero: (endereco_cliente && endereco_cliente.numero) || get(a, 'numero', 'number') || null,
      complemento: (endereco_cliente && endereco_cliente.complemento) || (endereco_loja && endereco_loja.observacao) || null,
      bairro: (endereco_cliente && endereco_cliente.bairro) || (endereco_loja && endereco_loja.bairro) || null,
      cidade: (endereco_cliente && endereco_cliente.cidade) || (endereco_loja && endereco_loja.cidade) || null,
      estado: (endereco_cliente && endereco_cliente.estado) || (endereco_loja && endereco_loja.estado) || null,
      cep: (endereco_cliente && endereco_cliente.cep) || (endereco_loja && endereco_loja.cep) || null,
      telefone: (endereco_cliente && endereco_cliente.telefone) || null,
      nome: (endereco_cliente && endereco_cliente.nome) || null
    };
  })();

  // canonical totals
  normalized.totals = normalized.totals || rs?.input?.totais || rs?.totais || {
    items_total: Number(normalized.total_bruto ?? normalized.total_liquido ?? 0) || 0,
    frete_total: Number(normalized.frete_valor ?? 0) || 0,
    desconto_total: Number(normalized.desconto_total ?? 0) || 0,
    grand_total: Number(normalized.total_liquido ?? normalized.total_bruto ?? 0) || 0
  };

  // canonical pagamentos
  normalized.pagamentos = normalized.pagamentos || normalized.payments || (normalized.raw_payment ? [normalized.raw_payment] : []) || [];

  // canonical cliente object
  normalized.cliente = normalized.cliente || rs?.cliente || rs?.input?.cliente || {
    nome: normalized.cliente_nome ?? normalized.cliente?.nome ?? null,
    email: normalized.cliente_email ?? normalized.cliente?.email ?? null,
    cpf: normalized.cliente_cpf ?? normalized.cliente?.cpf ?? null,
    id: normalized.cliente_id ?? normalized.cliente?.id ?? null,
  };

  return normalized;
}
