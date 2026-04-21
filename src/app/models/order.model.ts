export interface OrderItem {
  id?: number | string;
  produto_id?: number | string;
  nome?: string;
  quantidade?: number;
  preco_unit?: number;
  subtotal?: number;
  raw?: any;
}

export interface EnderecoEntrega {
  id?: number | string;
  nome?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  telefone?: string;
  raw?: any;
}

export interface Cliente {
  id?: number | string;
  nome?: string;
  email?: string;
  cpf?: string;
  telefone?: string;
  foto?: string | null;
  raw?: any;
}

export interface Totals {
  items_total?: number;
  frete_total?: number;
  desconto_total?: number;
  grand_total?: number;
  raw?: any;
}

export interface Order {
  id?: number | string;
  pedido_id?: number | string;
  created_at?: string;
  status?: string;
  cliente?: Cliente | null;
  cliente_nome?: string;
  cliente_email?: string;
  cliente_cpf?: string;
  endereco_entrega?: EnderecoEntrega | null;
  itens?: OrderItem[];
  totals?: Totals;
  pagamentos?: any[];
  raw_snapshot?: any;
  raw_shipping?: any;
  frete_valor?: number;
  raw?: any;
}
