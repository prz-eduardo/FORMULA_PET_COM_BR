/** Dados públicos genéricos da loja (demo / anonimizado). */

export interface LojaIdentidadeTelefone {
  display: string;
  tel: string;
}

export interface LojaIdentidadeSocialLink {
  kind: 'instagram';
  label: string;
  href: string;
}

export interface LojaIdentidade {
  marca: {
    nome: string;
    tagline: string;
    descricao: string;
    logoPath: string;
  };
  contato: {
    /** Vazio em demo; preencher no white label real. */
    emailPublico: string;
    horarioFuncionamento: string;
    telefone: LojaIdentidadeTelefone | null;
  };
  endereco: {
    linha1: string;
    cep: string;
  };
  mapa: {
    lat: number;
    lng: number;
    /** Texto bruto antes de encodeURIComponent (para manter query estável). */
    queryTexto: string;
  };
  social: {
    links: LojaIdentidadeSocialLink[];
  };
}

export const LOJA_IDENTIDADE: LojaIdentidade = {
  marca: {
    nome: 'PetSphere',
    tagline: 'Cuidados e produtos para pets',
    descricao:
      'Seleção de itens e serviços pensados para o bem-estar dos animais de estimação.',
    logoPath: '/imagens/logo-marca.svg',
  },
  contato: {
    emailPublico: '',
    horarioFuncionamento: 'Segunda a Sexta · 9h às 18h',
    telefone: null,
  },
  endereco: {
    linha1: 'Praça Tiradentes, s/n — Centro, Curitiba - PR',
    cep: '80020-010',
  },
  mapa: {
    lat: -25.4289,
    lng: -49.2733,
    queryTexto: 'Praça Tiradentes, Centro, Curitiba, PR, Brasil',
  },
  social: {
    links: [
      {
        kind: 'instagram',
        label: 'Instagram',
        href: 'https://www.instagram.com/',
      },
    ],
  },
};

/** Compat: exports nomeados usados pelo restante do app. */
export const MARCA_NOME = LOJA_IDENTIDADE.marca.nome;
export const MARCA_TAGLINE = LOJA_IDENTIDADE.marca.tagline;
export const MARCA_DESCRICAO = LOJA_IDENTIDADE.marca.descricao;
export const MARCA_LOGO_PATH = LOJA_IDENTIDADE.marca.logoPath;

export const LOJA_ENDERECO_TEXTO = LOJA_IDENTIDADE.endereco.linha1;
export const LOJA_CEP = LOJA_IDENTIDADE.endereco.cep;

export const LOJA_MAPA_LAT = LOJA_IDENTIDADE.mapa.lat;
export const LOJA_MAPA_LNG = LOJA_IDENTIDADE.mapa.lng;

export const LOJA_MAPA_QUERY = encodeURIComponent(LOJA_IDENTIDADE.mapa.queryTexto);

export const LOJA_MAPA_URL = `https://maps.google.com/?q=${LOJA_MAPA_QUERY}`;
