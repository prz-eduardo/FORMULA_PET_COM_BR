import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { BannerDto } from '../../services/admin-api.service';
import { BannersPublicService } from '../../services/banners-public.service';
import { BannerPosition } from '../banner/banner-positions';

type SlotMode = 'single' | 'carousel';

/**
 * Renderiza os banners ativos de uma determinada posição.
 * - Em modo `single` exibe o primeiro banner retornado (ou projeta o conteúdo
 *   do pai — `ng-content` — como fallback quando não há banners).
 * - Em modo `carousel` exibe todos em um Swiper com autoplay.
 *
 * Imagens são servidas como `<picture>` com `<source>` para mobile (<= 768px)
 * e `<img>` desktop, garantindo o banner adequado para cada dispositivo.
 */
@Component({
  selector: 'app-banner-slot',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <ng-container *ngIf="loaded && banners.length; else fallback">
      <ng-container *ngIf="mode === 'single'; else carouselTpl">
        <ng-container *ngTemplateOutlet="bannerTpl; context: { $implicit: banners[0] }"></ng-container>
      </ng-container>

      <ng-template #carouselTpl>
        <swiper-container
          #swiperRef
          class="banner-slot-swiper"
          [attr.loop]="banners.length > 1 ? 'true' : null"
          [attr.autoplay-delay]="autoplayDelay"
          [attr.autoplay-disable-on-interaction]="false"
          [attr.pagination]="banners.length > 1 ? 'true' : null"
          [attr.pagination-clickable]="'true'"
          [attr.slides-per-view]="1"
        >
          <swiper-slide *ngFor="let b of banners; trackBy: trackById">
            <ng-container *ngTemplateOutlet="bannerTpl; context: { $implicit: b }"></ng-container>
          </swiper-slide>
        </swiper-container>
      </ng-template>
    </ng-container>

    <ng-template #fallback>
      <ng-content></ng-content>
    </ng-template>

    <ng-template #bannerTpl let-b>
      <a
        *ngIf="b.link; else imageOnly"
        class="banner-slot-anchor"
        [href]="b.link"
        [attr.target]="b.target_blank ? '_blank' : null"
        [attr.rel]="b.target_blank ? 'noopener noreferrer' : null"
        [attr.aria-label]="b.alt || b.nome"
      >
        <ng-container *ngTemplateOutlet="pictureTpl; context: { $implicit: b }"></ng-container>
      </a>
      <ng-template #imageOnly>
        <ng-container *ngTemplateOutlet="pictureTpl; context: { $implicit: b }"></ng-container>
      </ng-template>
    </ng-template>

    <ng-template #pictureTpl let-b>
      <picture class="banner-slot-picture">
        <source *ngIf="b.mobile_image_url" media="(max-width: 768px)" [srcset]="b.mobile_image_url" />
        <img
          class="banner-slot-img"
          [src]="b.desktop_image_url || b.mobile_image_url"
          [alt]="b.alt || b.nome || 'Banner'"
          loading="lazy"
          decoding="async"
        />
      </picture>
    </ng-template>
  `,
  styleUrls: ['./banner-slot.component.scss'],
})
export class BannerSlotComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
  @Input({ required: true }) posicao!: BannerPosition;
  @Input() mode: SlotMode = 'single';
  @Input() autoplayDelay = 6000;

  @ViewChild('swiperRef') swiperRef?: ElementRef<any>;

  banners: BannerDto[] = [];
  loaded = false;

  private isBrowser: boolean;
  private registered = false;

  constructor(
    private service: BannersPublicService,
    @Inject(PLATFORM_ID) platformId: Object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.fetch();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['posicao'] && !changes['posicao'].firstChange) {
      this.fetch();
    }
  }

  async ngAfterViewInit(): Promise<void> {
    if (!this.isBrowser || this.mode !== 'carousel' || this.registered) return;
    try {
      const { register } = await import('swiper/element/bundle');
      register();
      this.registered = true;
    } catch {
      // Swiper pode não estar disponível em tempo de build SSR — fallback silencioso
    }
  }

  ngOnDestroy(): void { /* noop */ }

  private fetch() {
    if (!this.posicao) return;
    this.service.list(this.posicao).subscribe({
      next: (banners) => {
        this.banners = banners || [];
        this.loaded = true;
      },
      error: () => {
        this.banners = [];
        this.loaded = true;
      },
    });
  }

  trackById = (_: number, b: BannerDto) => b.id ?? b.desktop_image_url ?? b.nome ?? _;
}
