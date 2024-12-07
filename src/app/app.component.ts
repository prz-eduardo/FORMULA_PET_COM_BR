import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavmenuComponent } from './navmenu/navmenu.component';
import { SwiperTopoComponent } from './swiper-topo/swiper-topo.component';
import { HeroComponent } from './hero/hero.component';



@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavmenuComponent, SwiperTopoComponent, HeroComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'FORMULA_PET_COM_BR';
}
