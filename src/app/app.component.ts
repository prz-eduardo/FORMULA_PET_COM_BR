
import { RouterOutlet } from '@angular/router';
import { NavmenuComponent } from './navmenu/navmenu.component';
import { SwiperTopoComponent } from './swiper-topo/swiper-topo.component';
import { HeroComponent } from './hero/hero.component';
import { isPlatformBrowser } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { register } from 'swiper/element/bundle';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FooterComponent } from './footer/footer.component';
import { AboutComponent } from './about/about.component';
import { TestimonialsComponent } from './testimonials/testimonials.component';
import { ProductPreviewComponent } from './product-preview/product-preview.component';



@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ProductPreviewComponent,NavmenuComponent, SwiperTopoComponent, HeroComponent,CommonModule, FooterComponent, AboutComponent,TestimonialsComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  deviceType: string = 'desktop'; // Variável para armazenar o tipo de dispositivo

  
  title = 'FORMULA_PET_COM_BR';
  constructor(@Inject(PLATFORM_ID) private platformId: any) {
    register(); // Registra os elementos do Swiper para uso
  }
  
  // Método para detectar o tipo de dispositivo
    detectDevice(): void {

      // Verifica se o código está rodando no cliente (navegador)
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
        console.log('Running on server, window object not available');
      }
    }
}
