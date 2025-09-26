import { Component, inject, PLATFORM_ID, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { register } from 'swiper/element/bundle';
import Swiper from 'swiper/bundle';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-hero',
  standalone: true,
  templateUrl: './hero.component.html',
  styleUrls: ['./hero.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [CommonModule],
})
export class HeroComponent implements OnInit {
  slides = [
    {
      title: '',
      subtitle: 'Cuidados sob medida para o seu pet',
      text: 'Somos especialistas na manipulação de medicamentos veterinários, oferecendo soluções personalizadas.',
    },
    {
      title: '',
      subtitle: 'Excelência na manipulação veterinária',
      text: 'Na Fórmula Pet, trabalhamos com rigorosos padrões de qualidade para desenvolver medicamentos.',
    },
    {
      title: '',
      subtitle: 'Atendimento especializado e humanizado',
      text: 'Seja para cães, gatos ou outros animais, nossa equipe está pronta para oferecer suporte completo.',
    },
  ];
  isBrowser: boolean = false;

  constructor() {
    const platformId = inject(PLATFORM_ID);
    // this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      register();
    }
  }

  ngOnInit(): void {
  }
}
