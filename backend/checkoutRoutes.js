const express = require('express');
const router = express.Router();

// In-memory store (replace with DB integration as needed)
const orders = new Map();
let seq = 1;

// Helpers
function round2(n){ return Math.round((Number(n)||0) * 100) / 100; }
function computeItemsTotal(itens){
  return round2((itens||[]).reduce((acc, it) => acc + (Number(it.preco||it.price||it.valor_unitario||0) * Number(it.qtd||it.quantidade||1)), 0));
}
function normalizeFrete(order){
  // frete_valor pode vir de raw_shipping
  const frete = Number(order.frete_valor ?? order?.raw_shipping?.frete?.valor ?? 0);
  return round2(frete);
}

function applyCoupon(order, cupom){
  // cupom: { tipo: 'percentual'|'valor', valor: number, desconto_maximo?: number, frete_gratis?: boolean }
  const total_bruto = computeItemsTotal(order.itens);
  let desconto_cupom = 0;
  if (cupom) {
    if (cupom.tipo === 'percentual') desconto_cupom = round2(total_bruto * (Number(cupom.valor)||0) / 100);
    else if (cupom.tipo === 'valor') desconto_cupom = round2(Number(cupom.valor)||0);
    if (cupom.desconto_maximo != null) desconto_cupom = Math.min(desconto_cupom, round2(cupom.desconto_maximo));
  }
  let frete_valor = normalizeFrete(order);
  if (cupom?.frete_gratis) frete_valor = 0;
  order.cupom_aplicado = cupom || null;
  order.desconto_cupom = desconto_cupom;
  order.frete_valor = frete_valor;
  return { total_bruto, frete_valor, desconto_cupom };
}

function computePixDiscount(total_bruto, desconto_cupom, forma){
  const base = round2(total_bruto - desconto_cupom);
  const desconto_pix = forma === 'pix' ? round2(base * 0.10) : 0;
  return { base, desconto_pix };
}

function recomputeTotals(order){
  const total_bruto = computeItemsTotal(order.itens);
  const frete_valor = normalizeFrete(order);
  const desconto_cupom = round2(order.desconto_cupom || 0);
  const forma = order.pagamento_forma || null;
  const { desconto_pix } = computePixDiscount(total_bruto, desconto_cupom, forma);
  const desconto_total = round2(desconto_cupom + desconto_pix);
  const total_liquido = round2(total_bruto - desconto_total + frete_valor);
  Object.assign(order, { total_bruto, frete_valor, desconto_cupom, desconto_pix, desconto_total, total_liquido });
  return order;
}

// Create order
router.post('/orders', (req, res) => {
  const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
  const raw_shipping = req.body?.raw_shipping || null;
  const frete_valor = Number(req.body?.frete_valor ?? 0);
  const id = seq++;
  const base = {
    id,
    status: 'criado',
    itens,
    raw_shipping,
    frete_valor,
    desconto_cupom: 0,
    desconto_pix: 0,
    desconto_total: 0,
    pagamento_forma: null,
    total_bruto: computeItemsTotal(itens),
    total_liquido: 0,
    cupom_aplicado: null
  };
  recomputeTotals(base);
  orders.set(id, base);
  res.json(base);
});

// Get order
router.get('/orders/:id', (req, res) => {
  const id = Number(req.params.id);
  const order = orders.get(id);
  if (!order) return res.status(404).json({ message: 'Pedido não encontrado' });
  res.json(order);
});

// Update order (cupom/pagamento_forma)
router.patch('/orders/:id', (req, res) => {
  const id = Number(req.params.id);
  const order = orders.get(id);
  if (!order) return res.status(404).json({ message: 'Pedido não encontrado' });

  const body = req.body || {};
  // Aplica/atualiza cupom
  if (body.cupom) {
    // Simulação: o frontend envia objeto do cupom já validado ou um código + metadata
    const cupom = typeof body.cupom === 'object' ? body.cupom : null;
    applyCoupon(order, cupom);
  }
  // Atualiza forma de pagamento
  if (body.pagamento_forma) {
    order.pagamento_forma = String(body.pagamento_forma).toLowerCase();
  }

  // Recalcula descontos
  recomputeTotals(order);
  return res.json(order);
});

// Add payment
router.post('/orders/:id/payments', (req, res) => {
  const id = Number(req.params.id);
  const order = orders.get(id);
  if (!order) return res.status(404).json({ message: 'Pedido não encontrado' });

  // Reforça a lógica de desconto no momento do pagamento
  recomputeTotals(order);
  order.status = 'pago';
  // Push a payment record (basic)
  const pay = {
    id: `${id}-p1`,
    forma: order.pagamento_forma || 'desconhecido',
    valor: order.total_liquido,
    created_at: new Date().toISOString()
  };
  order.pagamento_ultimo = pay;
  res.json({ ok: true, order });
});

module.exports = router;
