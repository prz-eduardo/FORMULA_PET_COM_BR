import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

import { Swiper } from 'swiper/bundle';
import { register } from 'swiper/element/bundle';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-swiper-topo',
  standalone: true,
  imports: [CommonModule,FormsModule],
  templateUrl: './swiper-topo.component.html',
  styleUrls: ['./swiper-topo.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SwiperTopoComponent implements OnInit {
  deviceType: string = 'desktop'; // Variável para armazenar o tipo de dispositivo

  constructor() {
    register();
  }

  ngOnInit(): void {
    this.detectDevice(); // Detecta o tipo de dispositivo ao iniciar o componente

    const swiper = new Swiper('.swiper-container', {
      slidesPerView: 1,
      spaceBetween: 30,
      loop: true,
      pagination: {
        el: '.swiper-pagination',
        clickable: true,
      },
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
    });

    // Você pode usar this.deviceType aqui para customizar o comportamento
  }

  // Método para detectar o tipo de dispositivo
  detectDevice(): void {

    console.log('Detecting device...');
    const width = window.innerWidth;
console.log(width);
    if (width < 768) {
      this.deviceType = 'mobile';
    } else if (width >= 768 && width < 1024) {
      this.deviceType = 'tablet';
    } else {
      this.deviceType = 'desktop';
    }

    console.log(`Detected device: ${this.deviceType}`);
  }
}