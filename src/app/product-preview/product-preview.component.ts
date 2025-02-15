import { Component, OnInit, Inject, PLATFORM_ID, AfterViewInit } from '@angular/core';
import { Swiper } from 'swiper/bundle';
import { register } from 'swiper/element/bundle';
import ProdutosJson from '../../../public/products.json';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { isPlatformBrowser } from '@angular/common';
import { ProductCardComponent } from '../product-card/product-card.component';

@Component({
  selector: 'app-product-preview',
  standalone: true,
  imports: [CommonModule, ProductCardComponent],
  templateUrl: './product-preview.component.html',
  styleUrls: ['./product-preview.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ProductPreviewComponent implements OnInit, AfterViewInit {
  produtos: any[] = ProdutosJson;
  filteredProducts: any[] = ProdutosJson; // Lista de produtos filtrados
  deviceType: string | undefined;
  slidesPerView: number = 1;
  swiper: Swiper | undefined;
  selectedCategory: string = ''; // Categoria selecionada
  categories: string[] = []; // Lista de categorias únicas

  constructor(@Inject(PLATFORM_ID) private platformId: any) {
    register(); // Registra os elementos do Swiper para uso
  }

  ngOnInit() {
    this.detectDevice();
    this.extractCategories(); // Extrai as categorias únicas ao iniciar
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.initializeSwiper();
    }
  }

  slidesPerViewLoad() {
    if (isPlatformBrowser(this.platformId)) {
      const width = window.innerWidth;
      if (width < 768) {
        this.deviceType = 'mobile';
        this.slidesPerView = Math.floor((width - 10) / 300) + 0.2;
      } else if (width >= 768 && width < 1024) {
        this.deviceType = 'tablet';
        this.slidesPerView = Math.floor((width - 10) / 300) + 0.2;
      } else {
        this.deviceType = 'desktop';
        this.slidesPerView = Math.floor((width - 10) / 300) + 0.2;
      }

      if (this.swiper) {
        this.swiper.params.slidesPerView = this.slidesPerView;
        this.swiper.update();
      }
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
      this.slidesPerViewLoad();
    }
  }

  initializeSwiper() {
    this.swiper = new Swiper('.product-swiper', {
      slidesPerView: this.slidesPerView,
      spaceBetween: 10,
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
  }

  filterProductsByCategory(category: string): void {
    this.selectedCategory = category;
    if (category) {
      this.filteredProducts = this.produtos.filter(produto => produto.category === category);
    } else {
      this.filteredProducts = this.produtos;
    }
  }

  extractCategories() {
    const categoriesSet = new Set(this.produtos.map(produto => produto.category));
    this.categories = Array.from(categoriesSet);
  }
}
