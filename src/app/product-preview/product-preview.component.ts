import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import {  Swiper } from 'swiper/bundle';
import { register } from 'swiper/element/bundle';
import ProdutosJson from '../../../public/products.json';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { isPlatformBrowser } from '@angular/common';
import { ProductCardComponent } from '../product-card/product-card.component';

@Component({
  selector: 'app-product-preview',
  standalone: true,
  imports: [CommonModule,ProductCardComponent],
  templateUrl: './product-preview.component.html',
  styleUrl: './product-preview.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ProductPreviewComponent implements OnInit {
  produtos: any[] = ProdutosJson;
  deviceType: string | undefined;
  slidesPerView: number = 1;


  constructor(@Inject(PLATFORM_ID) private platformId: any) {
    register(); // Registra os elementos do Swiper para uso
  }

  async slidesPerViewLoad() {
    // Verifica se o código está rodando no cliente (navegador)
    if (isPlatformBrowser(this.platformId)) {
      const width = window.innerWidth;
      if (this.deviceType === 'mobile') {
        this.slidesPerView = 1;
      } else if (this.deviceType === 'tablet') {
        this.slidesPerView = 2;
      } else {
        this.slidesPerView = 3;
      }

       } else {
      }
  }

  async ngOnInit() {

    await this.slidesPerViewLoad();


    this.detectDevice();
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


  detectDevice(): void {
    if (isPlatformBrowser(this.platformId)) {
      const width = window.innerWidth;
     
      if (width < 768) {
        this.deviceType = 'mobile';
      } else if (width >= 768 && width < 1024) {
        this.deviceType = 'tablet';
      } else {
        this.deviceType = 'desktop';
      }

       } else {
      }
  }
}
