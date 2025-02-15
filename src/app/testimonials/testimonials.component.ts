import { Inject, PLATFORM_ID,Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { register } from 'swiper/element/bundle';
import { isPlatformBrowser } from '@angular/common';
import 'swiper/element/bundle';

@Component({
  selector: 'app-testimonials',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './testimonials.component.html',
  styleUrl: './testimonials.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class TestimonialsComponent implements OnInit, OnDestroy {
  isBrowser: boolean;
  activeIndex: number = 0;
  intervalId: any;

  testimonials = [
    {
      text: 'Ótimo atendimento via WhatsApp e presencial. Gostei do custo-benefício dos remédios que comprei para meu gato!',
      author: 'Juan Diego',
      image: 'https://lh3.googleusercontent.com/a-/ALV-UjXCll68zJ7joHMtEUrtO6C6QpRONaqZaOwb4niE2ojkvLTijrMG=s40-c-rp-mo-br100',
    },
    {
      text: 'Atendimento impecável! A rapidez e qualidade me surpreenderam. Recomendo de olhos fechados!',
      author: 'Aline Pilger',
      image: 'https://lh3.googleusercontent.com/a-/ALV-UjX8WbhkKc3QGN1eIfGlOlIGBn9NaTFRf9E2NGxekI5_kETkEgVi=s40-c-rp-mo-br100',
    },
    {
      text: 'Fizeram a medicação com capricho e rapidez. Minha cachorrinha aceitou tranquilamente. Super recomendo!',
      author: 'Marcia Gomes',
      image: 'https://lh3.googleusercontent.com/a-/ALV-UjWyMi-B376xFxoKRsMCpsuhES1JFaZ1b4p4hdAnMLutXKFIX_cM=s40-c-rp-mo-br100',
    },
  ];

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    register();
    // this.startAutoSlide();
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalId);
  }

  setActiveIndex(index: number): void {
    this.activeIndex = index;
  }

  startAutoSlide(): void {
    this.zone.run(() => {
      this.intervalId = setInterval(() => {
        this.activeIndex = (this.activeIndex + 1) % this.testimonials.length;
        this.cdr.detectChanges(); 
      }, 5000);
    });
  }
}
