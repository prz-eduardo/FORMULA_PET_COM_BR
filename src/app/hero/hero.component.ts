import { Component,CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { register } from 'swiper/element/bundle';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class HeroComponent {

  constructor() {
    register();
  }

}
