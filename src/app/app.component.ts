import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavmenuComponent } from './navmenu/navmenu.component';
import { SwiperTopoComponent } from './swiper-topo/swiper-topo.component';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavmenuComponent, SwiperTopoComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'FORMULA_PET_COM_BR';
}
