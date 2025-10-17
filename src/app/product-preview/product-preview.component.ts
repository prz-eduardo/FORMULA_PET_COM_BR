import { Component, OnInit, Inject, PLATFORM_ID, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { Swiper } from 'swiper/bundle';
import { register } from 'swiper/element/bundle';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ProductCardComponent } from '../product-card/product-card.component';

// Firebase
import { db } from '../firebase-config';
import { collection, getDocs } from 'firebase/firestore';

export interface Produto {
  id?: string;
  name: string;
  description: string;
  price: number;
  image?: string | null;
  category: string;
  customizations?: {
    dosage?: string[];
    packaging?: string[];
    size?: string[];
    scent?: string[];
  };
  discount?: number | null;
  rating?: number | null;
  stock?: number | null;
  tags?: string[];
  weightValue?: number | null;
  weightUnit?: string | null;
  isFavourite?: boolean;
  isAddedToCart?: boolean;
}

@Component({
  selector: 'app-product-preview',
  standalone: true,
  imports: [CommonModule, ProductCardComponent],
  templateUrl: './product-preview.component.html',
  styleUrls: ['./product-preview.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ProductPreviewComponent implements OnInit, AfterViewInit {
  produtos: Produto[] = [];
  filteredProducts: Produto[] = [];
  deviceType: string | undefined;
  slidesPerView: number = 1;
  swiper: Swiper | undefined;
  selectedCategory: string = '';
  categories: string[] = [];

  constructor(@Inject(PLATFORM_ID) private platformId: any, private router: Router) {
    register();
  }

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.detectDevice();
      await this.loadProductsFromFirebase();
    }
  }
  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.initializeSwiper();
      window.addEventListener('resize', () => this.slidesPerViewLoad());
    }
  }


  // ================= FIREBASE =================
  private async loadProductsFromFirebase() {
    try {
      const snapshot = await getDocs(collection(db, 'produtos'));
      this.produtos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Produto),
      }));
      this.filteredProducts = [...this.produtos];
      this.extractCategories();
      if (this.swiper) this.swiper.update();
    } catch (err) {
      console.error('Erro ao carregar produtos do Firestore:', err);
    }
  }

  // ================= SLIDER =================
  slidesPerViewLoad() {
    if (!isPlatformBrowser(this.platformId)) return;

    const width = window.innerWidth;
    if (width < 768) this.deviceType = 'mobile';
    else if (width >= 768 && width < 1024) this.deviceType = 'tablet';
    else this.deviceType = 'desktop';

    this.slidesPerView = Math.floor((width - 10) / 350) + 0.2;

    if (this.swiper) {
      this.swiper.params.slidesPerView = this.slidesPerView;
      this.swiper.update();
    }
  }

  detectDevice(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const width = window.innerWidth;
    this.deviceType = width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
    this.slidesPerViewLoad();
  }

  initializeSwiper() {
    this.swiper = new Swiper('.product-swiper', {
      slidesPerView: this.slidesPerView,
      spaceBetween: 10,
      loop: false,
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

  // ================= CATEGORIAS =================
  filterProductsByCategory(category: string): void {
    this.selectedCategory = category;
    this.filteredProducts = category
      ? this.produtos.filter(produto => produto.category === category)
      : this.produtos;
  }

  extractCategories() {
    const categoriesSet = new Set(this.produtos.map(produto => produto.category));
    this.categories = Array.from(categoriesSet);
  }

  async handleBuy(produto: { name?: string; category?: string }) {
    // Navigate to Loja with query params to prefilter by name/category
    const queryParams: any = {};
    if (produto.name) queryParams.q = produto.name;
    if (produto.category) queryParams.cat = produto.category;
    await this.router.navigate(['/loja'], { queryParams });
  }
}
