import { Component, HostListener, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { MARCA_NOME } from '../../constants/loja-public';

@Component({
  selector: 'app-em-breve',
  standalone: true,
  templateUrl: './em-breve.component.html',
  styleUrls: ['./em-breve.component.scss']
})
export class EmBreveComponent implements OnInit {
  readonly marca = MARCA_NOME;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private title: Title
  ) {}

  ngOnInit(): void {
    try {
      this.title.setTitle(`${this.marca} — em breve`);
    } catch {
      /* */
    }
    if (isPlatformBrowser(this.platformId)) {
      try {
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
      } catch {
        /* */
      }
    }
  }

  @HostListener('document:keydown', ['$event'])
  blockShortcuts(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
    }
  }
}
