import { Component, OnInit,CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import {Swiper} from 'swiper/bundle';
import { register } from 'swiper/element/bundle';




@Component({
  selector: 'app-swiper-topo',
  standalone: true,
  imports: [],
  templateUrl: './swiper-topo.component.html',
  styleUrls: ['./swiper-topo.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})


export class SwiperTopoComponent implements OnInit{
  constructor() {
    register();
  } 


  ngOnInit(): void {
    register();
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
  }
  

}
