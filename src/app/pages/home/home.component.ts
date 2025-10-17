import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
// import { SwiperTopoComponent } from '../../swiper-topo/swiper-topo.component';
// import { HeroComponent } from '../../hero/hero.component';
import { ProductPreviewComponent } from '../../product-preview/product-preview.component';
import { FooterComponent } from '../../footer/footer.component';
import { NavmenuComponent } from '../../navmenu/navmenu.component';
import { StoreService, ShopProduct } from '../../services/store.service';
import { RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';

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
  // SwiperTopoComponent,
  // HeroComponent,
    ProductPreviewComponent,
    FooterComponent,
    NavmenuComponent,
    RouterLink,
    CurrencyPipe,
    // TestimonialsComponent,
    // AboutComponent,
    // ContactComponent
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  produtos: ShopProduct[] = [];
  constructor(public store: StoreService) {}
}
