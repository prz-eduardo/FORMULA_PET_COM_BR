import { Component, OnInit, AfterViewInit, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavmenuComponent } from './navmenu/navmenu.component';
import { SwiperTopoComponent } from './swiper-topo/swiper-topo.component';
import { HeroComponent } from './hero/hero.component';
import { FooterComponent } from './footer/footer.component';
import { AboutComponent } from './about/about.component';
import { TestimonialsComponent } from './testimonials/testimonials.component';
import { ProductPreviewComponent } from './product-preview/product-preview.component';
import { register } from 'swiper/element/bundle';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    NavmenuComponent,
    SwiperTopoComponent,
    HeroComponent,
    FooterComponent,
    AboutComponent,
    TestimonialsComponent,
    ProductPreviewComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, AfterViewInit {
  title = 'FORMULA_PET_COM_BR';
  deviceType: string = 'desktop';

  constructor(@Inject(PLATFORM_ID) private platformId: any) {
    register(); // Swiper
  }

  ngOnInit(): void {
    this.detectDevice();

    if (isPlatformBrowser(this.platformId)) {
      this.loadElfsightScript();
    }
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Remove o badge de branding do Elfsight depois que o widget carregar
      // Tentando várias vezes porque o widget pode demorar pra renderizar
      let tries = 0;
      const maxTries = 5;
      const intervalId = setInterval(() => {
        const badge = document.querySelector('a[href*="elfsight.com/google-reviews-widget"]');
        if (badge) {
          badge.remove();
          console.log('Badge Elfsight removido.');
          clearInterval(intervalId);
        } else if (++tries >= maxTries) {
          clearInterval(intervalId);
          console.warn('Não encontrou o badge Elfsight após várias tentativas.');
        }
      }, 1000);
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
    }
  }

  loadElfsightScript(): void {
    const existingScript = document.getElementById('elfsight-script');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'elfsight-script';
      script.src = 'https://static.elfsight.com/platform/platform.js';
      script.defer = true;
      document.body.appendChild(script);
    }
  }
}
