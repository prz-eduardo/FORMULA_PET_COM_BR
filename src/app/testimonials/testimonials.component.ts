import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-testimonials',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './testimonials.component.html',
  styleUrl: './testimonials.component.scss'
})
export class TestimonialsComponent implements OnInit, OnDestroy {
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
    private cdr: ChangeDetectorRef,
    private zone: NgZone // Importando NgZone
  ) {}

  ngOnInit(): void {
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
        this.cdr.detectChanges(); // Forçar a detecção de mudanças após atualizar o activeIndex
      }, 5000); // Troca a cada 5 segundos
    });
  }
}
