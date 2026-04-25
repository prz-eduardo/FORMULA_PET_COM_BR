/** Dados públicos genéricos da loja (demo / anonimizado). */

export const MARCA_NOME = 'Loja Pet';
export const MARCA_TAGLINE = 'Cuidados e produtos para pets';
export const MARCA_DESCRICAO =
  'Seleção de itens e serviços pensados para o bem-estar dos animais de estimação.';

export const LOJA_ENDERECO_TEXTO =
  'Praça Tiradentes, s/n — Centro, Curitiba - PR';
export const LOJA_CEP = '80020-010';

/** Centro aproximado de Curitiba (Praça Tiradentes). */
export const LOJA_MAPA_LAT = -25.4289;
export const LOJA_MAPA_LNG = -49.2733;

export const LOJA_MAPA_QUERY = encodeURIComponent(
  'Praça Tiradentes, Centro, Curitiba, PR, Brasil',
);

export const LOJA_MAPA_URL = `https://maps.google.com/?q=${LOJA_MAPA_QUERY}`;

/** Caminho da logo da marca (navbar, footer, institucional). */
export const MARCA_LOGO_PATH = '/imagens/logo-marca.svg';
