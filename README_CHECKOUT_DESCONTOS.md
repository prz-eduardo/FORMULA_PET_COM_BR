# Checkout - Sistema de Descontos

Este documento descreve a lógica e o fluxo implementados no backend `/checkout` para cálculo de descontos com **Cupom** e **PIX**, e como isso aparece na API e na loja.

## Endpoints

- POST `/checkout/pedidos` — Cria um pedido
- PUT `/checkout/pedidos/:id` — Atualiza cupom e/ou forma de pagamento (totais recalculados)
- POST `/checkout/pedidos/:id/pagamentos` — Registra pagamento e pode reforçar desconto PIX

## Percentual PIX (configurável)

- O percentual vem da tabela `promocoes_config.pix_discount_percent` (admin **Promoções** → painel de configuração global).
- Valor entre **0** e **100** (decimais permitidos, ex.: 7,5).
- **0** desativa o desconto PIX: o backend não aplica `desconto_pix` e o checkout não exibe a linha/badge de desconto PIX.
- Valor por omissão após migration típica: **10** (equivalente ao comportamento antigo fixo em 10%).

## Fluxo Completo

1) Criação do pedido

- `total_bruto`: soma dos subtotais dos itens
- `desconto_total = 0` inicialmente (sem cupom/PIX ainda, salvo fluxo específico)
- `total_liquido = total_bruto - desconto_total + frete_valor`

2) Aplicação de cupom (PUT)

- Calcula `desconto_cupom` com o pipeline de elegibilidade (`couponEligibilityService` + itens do pedido).
- Respeita `desconto_maximo` do cupom e `cupons_config` (teto global, cumulatividade com promo, etc.).
- `frete_gratis`: zera `frete_valor` sem somar em `desconto_total`.
- Em seguida recalcula PIX se `pagamento_forma` for PIX e `pix_discount_percent > 0`.

3) Forma de pagamento PIX (PUT)

- Se `pagamento_forma` contém `pix` e `P = pix_discount_percent > 0`:
  - `base = total_bruto - desconto_cupom`
  - `desconto_pix = base * (P / 100)`
  - `desconto_total = desconto_cupom + desconto_pix`
- Se `P = 0`, `desconto_pix = 0` mesmo em PIX.
- Ao sair de PIX para outro método, o recálculo remove a parte PIX e mantém só o cupom.

4) Resposta `totals` (GET pedido / PUT retorno)

- `discount_total`: `desconto_total` persistido (cupom + PIX).
- `cupom_total`: desconto do cupom **recomputado** a partir dos itens (para exibição correta).
- `pix_total`: parte PIX (`max(0, discount_total - cupom_total)` com clamp à fórmula acima).
- `pix_discount_percent`: valor **P** da config (para o front mostrar o rótulo).
- `grand_total`: total a pagar (itens após descontos + frete).

## Fórmulas

- `total_bruto = sum(itens[i].subtotal)` (subtotal por linha no pedido)
- `desconto_cupom` = resultado do motor de cupons sobre os itens
- `desconto_pix = (pagamento_forma é PIX e P > 0) ? (total_bruto - desconto_cupom) * (P/100) : 0`
- `desconto_total = desconto_cupom + desconto_pix`
- `total_liquido = total_bruto - desconto_total + frete_valor`

Frete grátis por cupom zera `frete_valor` e não entra em `desconto_total`.

## Exemplos (com P = 10)

1) Apenas cupom — total_bruto 100, frete 10, cupom 20%

- desconto_cupom = 20; desconto_pix = 0; total_liquido = 90

2) Apenas PIX — total_bruto 100, frete 10, PIX, P = 10

- desconto_cupom = 0; desconto_pix = 10; total_liquido = 100

3) Cupom + PIX — total_bruto 100, frete 10, cupom 20%, PIX, P = 10

- desconto_cupom = 20; base = 80; desconto_pix = 8; total_liquido = 82

## Frontend (checkout)

- O checkout chama PUT com `pagamento_forma` ao mudar o método, para alinhar totais ao backend.
- O **total a pagar** usa `totals.grand_total` (sem aplicar percentual de PIX uma segunda vez no cliente).
- A linha de PIX só aparece se o método for PIX **e** `pix_discount_percent > 0`.

## Validações e regras

- Cupom: ativo, validade, uso, valor mínimo, primeira compra, limites — conforme implementação em `checkoutController` / `couponEligibilityService`.

> O cálculo oficial de valores fica no backend; a configuração **P** fica em `promocoes_config`.
