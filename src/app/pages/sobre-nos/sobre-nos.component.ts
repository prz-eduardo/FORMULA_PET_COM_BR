import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MARCA_NOME } from '../../constants/loja-public';

interface Pilar {
  emoji: string;
  title: string;
  lead: string;
  items: string[];
  footer?: string;
  accent: 'yellow' | 'mint' | 'rose';
}

interface Etapa {
  icon: string;
  title: string;
  lead: string;
  items: string[];
}

interface Plano {
  accent: 'start' | 'pro' | 'business' | 'premium';
  badge: string;
  title: string;
  subtitle: string;
  objective: string;
  summary: string;
  featured?: boolean;
  items: string[];
}

@Component({
  selector: 'app-sobre-nos',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sobre-nos.component.html',
  styleUrls: ['./sobre-nos.component.scss'],
})
export class SobreNosComponent {
  readonly marcaNome = MARCA_NOME;
  readonly ecossistemaImgPath = '/imagens/petsphere-ecossistema.png';

  readonly pilares: Pilar[] = [
    {
      emoji: '🧩',
      title: 'Gestao de estabelecimentos',
      lead: 'Tudo que um petshop ou clinica precisa para operar com menos atrito e mais controle.',
      items: [
        'Agenda de atendimentos e serviços',
        'Cadastro de clientes e pets',
        'Histórico completo de atendimentos',
        'Organização de procedimentos',
        'Gestão operacional do dia a dia',
      ],
      footer: 'Menos bagunca, mais controle para a operação crescer com previsibilidade.',
      accent: 'yellow',
    },
    {
      emoji: '📍',
      title: 'Marketplace e visibilidade',
      lead: 'Seja encontrado por novos clientes na sua regiao com presenca digital integrada a plataforma.',
      items: [
        'Presença no mapa com busca por serviços',
        'Vitrine de produtos e serviços',
        'Divulgação local automatizada',
        'Destaque para aumentar visibilidade',
      ],
      accent: 'mint',
    },
    {
      emoji: '🐾',
      title: 'Perfil inteligente do pet',
      lead: 'Cada pet com um histórico organizado para dar contexto a tutores e profissionais.',
      items: [
        'Informações de saúde',
        'Alergias e restrições',
        'Preferências e comportamento',
        'Histórico de atendimentos',
      ],
      footer: 'Melhor experiência para tutores e profissionais em cada novo atendimento.',
      accent: 'rose',
    },
  ];

  readonly etapas: Etapa[] = [
    {
      icon: 'fa-solid fa-shop',
      title: 'Organize sua operação',
      lead: 'Centralize o que hoje costuma ficar espalhado entre planilhas, WhatsApp e cadernos.',
      items: [
        'Cadastre clientes, pets, serviços e rotinas',
        'Mantenha agenda e histórico acessíveis no mesmo fluxo',
        'Ganhe previsibilidade para a equipe operar melhor',
      ],
    },
    {
      icon: 'fa-solid fa-map-location-dot',
      title: 'Ganhe presença digital',
      lead: 'A PetSphere transforma sua estrutura em vitrine, mapa e ponto de descoberta local.',
      items: [
        'Apareça para clientes buscando serviços na região',
        'Exiba produtos e serviços em um ambiente integrado',
        'Use destaque e presença digital para ampliar alcance',
      ],
    },
    {
      icon: 'fa-solid fa-paw',
      title: 'Atenda com mais contexto',
      lead: 'Cada novo atendimento pode começar com mais informação e menos retrabalho.',
      items: [
        'Consulte dados de saúde, restrições e comportamento do pet',
        'Mantenha um histórico vivo de interações e atendimentos',
        'Entregue uma experiência melhor para tutor e profissional',
      ],
    },
  ];

  readonly planos: Plano[] = [
    {
      accent: 'start',
      badge: 'Entrada',
      title: 'Plano Start',
      subtitle: 'Ideal para quem esta comecando ou quer testar a plataforma.',
      objective: 'Entrar e comecar a usar',
      summary: 'START -> entrar',
      items: [
        'Presenca no mapa PetSphere',
        'Perfil basico do estabelecimento',
        'Cadastro de ate 50 clientes',
        'Cadastro de pets',
        'Agenda simples limitada',
        '1 usuario (dono)',
        'Pagina padrao (sualoja.petsphere.com.br)',
      ],
    },
    {
      accent: 'pro',
      badge: 'Principal',
      title: 'Plano Pro',
      subtitle: 'Ideal para negocios em operacao que querem organizacao e crescimento.',
      objective: 'Organizar e profissionalizar o negocio',
      summary: 'PRO -> organizar',
      featured: true,
      items: [
        'Tudo do plano START',
        'Clientes ilimitados',
        'Pets ilimitados',
        'Agenda completa (servicos e horarios)',
        'Historico de atendimentos',
        'Gestao de servicos',
        'Vitrine de produtos e servicos',
        'Ate 3 usuarios',
        'Painel completo com dashboard',
      ],
    },
    {
      accent: 'business',
      badge: 'Operacao',
      title: 'Plano Business',
      subtitle: 'Ideal para quem quer vender mais e integrar operacao fisica + digital.',
      objective: 'Operar o dia a dia dentro do sistema',
      summary: 'BUSINESS -> operar',
      items: [
        'Tudo do plano PRO',
        'Gestao de produtos (estoque)',
        'Vendas no sistema (PDV basico)',
        'Integracao com codigo de barras (bip -> carrinho)',
        'Controle de estoque automatico',
        'Relatorios basicos de vendas',
        'Ate 5 usuarios',
      ],
    },
    {
      accent: 'premium',
      badge: 'Escala',
      title: 'Plano Premium',
      subtitle: 'Ideal para negocios maiores ou em expansao.',
      objective: 'Escala, controle e posicionamento',
      summary: 'PREMIUM -> escalar',
      items: [
        'Tudo do plano BUSINESS',
        'Usuarios adicionais (cobranca por usuario extra)',
        'Permissoes avancadas por funcao (admin, vet, atendente e outros)',
        'Dominio proprio (www.sualoja.com.br)',
        'Destaque no mapa',
        'Personalizacao visual (branding)',
        'Relatorios avancados',
        'Prioridade em suporte',
      ],
    },
  ];

  readonly addons: string[] = [
    'Usuario adicional (+R$X por usuario)',
    'Pacotes de destaque no mapa',
    'Personalizacao avancada',
    'Setup assistido',
    'Integracoes futuras (pagamento e outras)',
  ];
}
