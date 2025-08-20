import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SwiperTopoComponent } from '../../swiper-topo/swiper-topo.component';
import { HeroComponent } from '../../hero/hero.component';
import { ProductPreviewComponent } from '../../product-preview/product-preview.component';
import { FooterComponent } from '../../footer/footer.component';
import { NavmenuComponent } from '../../navmenu/navmenu.component';

// import { HeroComponent } from '../hero/hero.component';
// import { ProductPreviewComponent } from '../product-preview/product-preview.component';
// import { TestimonialsComponent } from '../testimonials/testimonials.component';
// import { AboutComponent } from '../about/about.component';
// import { ContactComponent } from '../contact/contact.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    SwiperTopoComponent,
    HeroComponent,
    ProductPreviewComponent,
    FooterComponent,
    NavmenuComponent,
    // TestimonialsComponent,
    // AboutComponent,
    // ContactComponent
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {}
