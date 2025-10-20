# Checkout - Sistema de Descontos

Este documento descreve a lógica e o fluxo implementados no backend `/checkout` para cálculo de descontos com Cupom e PIX.

## Endpoints

- POST `/checkout/orders` — Cria um pedido (in-memory nesta PoC)
- GET `/checkout/orders/:id` — Detalhes do pedido
- PATCH `/checkout/orders/:id` — Atualiza cupom e/ou forma de pagamento
- POST `/checkout/orders/:id/payments` — Confirma pagamento e reforça cálculos

## Fluxo Completo

1) Criação do Pedido
- total_bruto: soma dos subtotais dos itens
- desconto_total = 0 inicialmente
- total_liquido = total_bruto + frete

2) Aplicação de Cupom (PATCH)
- Calcula `desconto_cupom` por tipo (percentual/valor)
- Respeita `desconto_maximo` se houver
- `frete_gratis`: zera `frete_valor` sem somar em `desconto_total`
- Neste momento `desconto_total = desconto_cupom`

3) Seleção de Forma de Pagamento (PATCH)
- Para `pagamento_forma = pix`, aplica 10% SOBRE o valor pós-cupom:
  - `base = total_bruto - desconto_cupom`
  - `desconto_pix = base * 0.10`
  - `desconto_total = desconto_cupom + desconto_pix`
- Ao trocar de PIX para outro método, zera `desconto_pix` e mantém cupom

4) Confirmação de Pagamento (POST)
- Recalcula os totais para garantir consistência
- Marca status como `pago`

## Fórmulas

- `total_bruto = sum(itens[i].preco * itens[i].qtd)`
- `frete_valor` vem de `raw_shipping` ou requisição
- `desconto_cupom` depende de `tipo` e `valor`, com `desconto_maximo`
- `desconto_pix = pagamento_forma == 'pix' ? (total_bruto - desconto_cupom) * 0.10 : 0`
- `desconto_total = desconto_cupom + desconto_pix`
- `total_liquido = total_bruto - desconto_total + frete_valor`

> Observação: Frete grátis via cupom zera `frete_valor` e não entra em `desconto_total`.

## Exemplos de Cálculo

1) Apenas Cupom
- total_bruto: 100; frete: 10; cupom 20%
- desconto_cupom = 20
- desconto_pix = 0
- desconto_total = 20
- total_liquido = 100 - 20 + 10 = 90

2) Apenas PIX
- total_bruto: 100; frete: 10; pagamento: pix
- desconto_cupom = 0
- desconto_pix = 100 * 0.10 = 10
- desconto_total = 10
- total_liquido = 100 - 10 + 10 = 100

3) Cupom + PIX
- total_bruto: 100; frete: 10; cupom 20%; pagamento: pix
- desconto_cupom = 20
- base = 80; desconto_pix = 8
- desconto_total = 28
- total_liquido = 100 - 28 + 10 = 82

4) Cupom c/ Desconto Máximo + PIX
- total_bruto: 200; frete: 15; cupom 50% lim 30; pagamento: pix
- desconto_cupom = min(200*0.5, 30) = 30
- base = 170; desconto_pix = 17
- desconto_total = 47
- total_liquido = 200 - 47 + 15 = 168

5) Cupom c/ Frete Grátis + PIX
- total_bruto: 100; frete original: 20; cupom 15% + frete_gratis; pagamento: pix
- desconto_cupom = 15
- frete_valor = 0 (grátis)
- base = 85; desconto_pix = 8.5
- desconto_total = 23.5
- total_liquido = 100 - 23.5 + 0 = 76.5

## Validações e Regras (a implementar com DB)

- Cupom ativo, validade, uso máximo global/por cliente
- Valor mínimo do pedido
- Primeira compra paga
- Registro em `cupons_uso`

Nesta PoC, o endpoint PATCH assume que o frontend envia um objeto `cupom` já validado (ou que a validação será integrada ao conectar com o banco).

## Fluxo no Frontend (sugestão)

1. POST `/checkout/orders` (com itens)
2. PATCH `/checkout/orders/:id` { "cupom": { ... } } (opcional)
3. PATCH `/checkout/orders/:id` { "pagamento_forma": "pix" } (opcional)
4. POST `/checkout/orders/:id/payments`

UI sugerida:
- Subtotal
- Desconto Cupom
- Desconto PIX (10%)
- Frete
- Total

> O cálculo oficial acontece no backend.
