import { Component, OnInit, Inject, PLATFORM_ID, AfterViewInit } from '@angular/core';
import { register } from 'swiper/element/bundle';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { isPlatformBrowser } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

/**
 * @deprecated Este componente foi substituído por `app-banner-slot`
 * (`src/app/shared/banner-slot/banner-slot.component.ts`), que lê os banners
 * cadastrados no admin e usa `<picture>` + `srcset` para servir a imagem
 * correta em desktop/mobile sem depender de `window.innerWidth`.
 *
 * Prefira `<app-banner-slot posicao="home_hero">…fallback…</app-banner-slot>`.
 * Este arquivo é mantido temporariamente apenas para compatibilidade.
 */
@Component({
  selector: 'app-swiper-topo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './swiper-topo.component.html',
  styleUrls: ['./swiper-topo.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class SwiperTopoComponent implements OnInit, AfterViewInit {
  deviceType: string = 'desktop'; 
  imagem: string = '';

  constructor(@Inject(PLATFORM_ID) private platformId: any) {
    register(); // Registra os elementos do Swiper para uso
  }

  ngAfterViewInit(): void {
    this.detectDevice();
  }

  ngOnInit(): void {
    // this.detectDevice();
  }

  // Método para detectar o tipo de dispositivo
  detectDevice(): void {

    // Verifica se o código está rodando no cliente (navegador)
    if (isPlatformBrowser(this.platformId)) {
      const width = window.innerWidth;
      console.log('width', width);
      

      if (window.innerWidth < 768) {
        Promise.resolve().then(() => {
          this.imagem = '/imagens/banner-cel.png';
          console.log('imagem', this.imagem);
        });
      } else {
        Promise.resolve().then(() => {
          this.imagem = '/imagens/1.png';
          console.log('imagem', this.imagem);
        });
      }
    } else {
    }
  }
}
