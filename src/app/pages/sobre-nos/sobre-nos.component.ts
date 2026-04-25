import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface MvvCard {
  icon: string;
  title: string;
  text: string;
  accent: 'yellow' | 'mint' | 'rose';
}

interface Differential {
  icon: string;
  title: string;
  text: string;
}

interface TeamMember {
  name: string;
  role: string;
  bio: string;
  image: string;
  initials: string;
}

interface TimelineStep {
  icon: string;
  title: string;
  text: string;
}

interface StatItem {
  value: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-sobre-nos',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sobre-nos.component.html',
  styleUrls: ['./sobre-nos.component.scss']
})
export class SobreNosComponent {
  stats: StatItem[] = [
    { value: '+10', label: 'anos cuidando de pets', icon: 'fa-solid fa-heart-pulse' },
    { value: '+5k', label: 'fórmulas manipuladas', icon: 'fa-solid fa-flask' },
    { value: '100%', label: 'atendimento humanizado', icon: 'fa-solid fa-paw' },
    { value: 'Seg–Sex', label: 'atendimento na loja', icon: 'fa-solid fa-clock' },
  ];

  mvv: MvvCard[] = [
    {
      icon: 'fa-solid fa-bullseye',
      title: 'Missão',
      text: 'Oferecer saúde e bem-estar aos pets com fórmulas personalizadas, seguras e eficazes, priorizando a qualidade de vida de cada paciente.',
      accent: 'yellow',
    },
    {
      icon: 'fa-solid fa-eye',
      title: 'Visão',
      text: 'Ser a farmácia de manipulação veterinária mais confiável e inovadora do país, reconhecida pela excelência no atendimento e nos produtos.',
      accent: 'mint',
    },
    {
      icon: 'fa-solid fa-hand-holding-heart',
      title: 'Valores',
      text: 'Compromisso, ética, transparência, cuidado com os animais e inovação constante são a base de tudo que fazemos.',
      accent: 'rose',
    },
  ];

  differentials: Differential[] = [
    {
      icon: 'fa-solid fa-flask-vial',
      title: 'Fórmulas sob medida',
      text: 'Cada manipulação é pensada para a espécie, o peso e a condição clínica do seu pet.',
    },
    {
      icon: 'fa-solid fa-shield-heart',
      title: 'Qualidade certificada',
      text: 'Rigoroso controle de qualidade em todas as etapas, da matéria-prima à embalagem.',
    },
    {
      icon: 'fa-solid fa-truck-fast',
      title: 'Entrega ágil',
      text: 'Receba a fórmula do seu pet com rapidez em toda a região, com cuidado no transporte.',
    },
    {
      icon: 'fa-solid fa-stethoscope',
      title: 'Apoio ao veterinário',
      text: 'Parceria técnica com profissionais para indicar apresentações ideais para cada tratamento.',
    },
  ];

  team: TeamMember[] = [
    {
      name: 'Kamyla',
      role: 'Co-fundadora · Química',
      bio: 'Especialista em Química com dedicação total ao cuidado animal. Garante qualidade e eficácia em cada fórmula.',
      image: '/imagens/kamy.jpg',
      initials: 'KA',
    },
    {
      name: 'Heryck',
      role: 'Co-fundador · Químico',
      bio: 'Olhar técnico e atento à saúde dos pets. Assegura segurança e precisão em todos os processos.',
      image: '/imagens/heryck.jpg',
      initials: 'HE',
    },
  ];

  timeline: TimelineStep[] = [
    {
      icon: 'fa-solid fa-prescription',
      title: 'Receita do veterinário',
      text: 'Traga a receita em nossa loja ou envie conforme orientação no pedido.',
    },
    {
      icon: 'fa-solid fa-clipboard-check',
      title: 'Avaliação técnica',
      text: 'Analisamos a prescrição e sugerimos a melhor apresentação.',
    },
    {
      icon: 'fa-solid fa-mortar-pestle',
      title: 'Manipulação cuidadosa',
      text: 'Preparamos a fórmula com precisão, segurança e carinho.',
    },
    {
      icon: 'fa-solid fa-box-heart',
      title: 'Entrega ao seu pet',
      text: 'Você retira ou recebe em casa com toda tranquilidade.',
    },
  ];

}
