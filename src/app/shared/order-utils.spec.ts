import { normalizeOrder } from './order-utils';

describe('order-utils normalizeOrder', () => {
  it('should normalize a backend order shape', () => {
    const sample: any = {
      id: 44,
      cliente: { id: 2, nome: 'EDUARDO DOS PRAZERESx', cpf: '06845980942', email: 'prz.eduardo92@gmail.com' },
      itens: [{ id: 101, produto_id: 34, nome: 'amox', quantidade: 1, preco_unit: 123.12, subtotal: 123.12 }],
      endereco_entrega: { id: 1, cep: '82820050', nome: 'Casa', logradouro: 'Rua Joaquim da Costa Ribeiro', numero: '624', bairro: 'Bairro Alto', cidade: 'Curitiba', estado: 'PR' },
      totals: { items_total: 123.12, frete_total: 17.91, desconto_total: 0, grand_total: 141.03 }
    };

    const n = normalizeOrder(sample);
    expect(n.id).toBe(44);
    expect(n.cliente).toBeTruthy();
    expect(n.cliente.nome).toBe('EDUARDO DOS PRAZERESx');
    expect(n.cliente.cpf).toBe('06845980942');
    expect(Array.isArray(n.itens)).toBeTrue();
    expect(n.itens.length).toBe(1);
    expect(n.endereco_entrega).toBeTruthy();
    expect(n.endereco_entrega.cep).toBe('82820050');
    expect(n.totals).toBeTruthy();
    expect(n.totals.items_total).toBeCloseTo(123.12, 2);
  });
});
