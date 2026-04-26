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

  pilares: Pilar[] = [
    {
      emoji: '🧩',
      title: 'Gestão de estabelecimentos pet',
      lead: 'Ferramentas completas para petshops e clínicas veterinárias gerenciarem sua operação diária, incluindo:',
      items: [
        'Agenda de atendimentos e serviços',
        'Cadastro de clientes e pets',
        'Controle de serviços oferecidos',
        'Organização de procedimentos e histórico de atendimentos',
        'Gestão operacional do negócio',
      ],
      footer:
        'Tudo isso para facilitar o dia a dia e aumentar a eficiência dos estabelecimentos.',
      accent: 'yellow',
    },
    {
      emoji: '📍',
      title: 'Marketplace de serviços e produtos pet',
      lead:
        'Um ecossistema onde prestadores podem ser encontrados, avaliados e contratados, com visibilidade local e presença digital.',
      items: [
        'Exibição no mapa de serviços próximos',
        'Divulgação de petshops, veterinários e prestadores',
        'Vitrine de produtos e serviços',
        'Sistema de destaque pago para maior visibilidade',
      ],
      accent: 'mint',
    },
    {
      emoji: '🐾',
      title: 'Central de dados do pet',
      lead: 'Um histórico digital completo do pet, incluindo:',
      items: [
        'Informações de saúde',
        'Alergias e restrições',
        'Preferências e comportamento',
        'Histórico de atendimentos e serviços',
      ],
      footer:
        'Tudo organizado para melhorar a experiência do tutor e dos profissionais.',
      accent: 'rose',
    },
  ];
}
