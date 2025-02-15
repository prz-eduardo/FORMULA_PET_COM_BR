import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { Swiper } from 'swiper/bundle';
import { register } from 'swiper/element/bundle';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { isPlatformBrowser } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
  selector: 'app-swiper-topo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './swiper-topo.component.html',
  styleUrls: ['./swiper-topo.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]  // Adicionei essa linha aqui para permitir componentes personalizados
})
export class SwiperTopoComponent implements OnInit {
  deviceType: string = 'desktop'; // Variável para armazenar o tipo de dispositivo

  constructor(@Inject(PLATFORM_ID) private platformId: any) {
    register(); // Registra os elementos do Swiper para uso
  }

  ngOnInit(): void {
    this.detectDevice(); // Detecta o tipo de dispositivo ao iniciar o componente

    // Verifica se o código está sendo executado no cliente (navegador)
    if (isPlatformBrowser(this.platformId)) {
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
    } else {
    }
  }

  // Método para detectar o tipo de dispositivo
  detectDevice(): void {

    // Verifica se o código está rodando no cliente (navegador)
    if (isPlatformBrowser(this.platformId)) {
      const width = window.innerWidth;
      console.log('width', width);

      if (width < 768) {
        console.log('mobile');
        this.deviceType = 'mobile';
      } 
      else {
        console.log('desktop'); 
        this.deviceType = 'desktop';
      }

    } else {
    }
  }
}
