import { Component, AfterViewInit, Inject, PLATFORM_ID, HostListener } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-navmenu',
  standalone: true,
  templateUrl: './navmenu.component.html',
  styleUrls: ['./navmenu.component.scss']
})
export class NavmenuComponent implements AfterViewInit {
  // Inicializa com 0 para evitar acesso ao window fora do navegador
  previousScroll: number = 0;
  isVisible = true;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngAfterViewInit(): void {
    // Executa somente no navegador
    if (isPlatformBrowser(this.platformId)) {
      // Usa scrollY em vez de pageYOffset
      this.previousScroll = window.scrollY;

      const iconMenu: HTMLElement | null = document.querySelector('.icon-menu');
      const menu: HTMLElement | null = document.querySelector('.menu');
      const menuLink: NodeListOf<HTMLElement> = document.querySelectorAll('.menu-link.sub');

      if (iconMenu && menu) {
        iconMenu.addEventListener('click', this.openMenu.bind(this, menu, iconMenu));
        menuLink.forEach((el) => {
          el.addEventListener('click', this.openSubmenu);
        });
      }
    }
  }

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    // Garante que o código só será executado no navegador
    if (isPlatformBrowser(this.platformId)) {
      const currentScroll = window.scrollY;
      if (currentScroll < this.previousScroll) {
        // Rolagem para cima: exibe a navbar
        this.isVisible = true;
      } else if (currentScroll > this.previousScroll) {
        // Rolagem para baixo: oculta a navbar
        this.isVisible = false;
      }
      this.previousScroll = currentScroll;
    }
  }

  private openMenu(menu: HTMLElement, iconMenu: HTMLElement): void {
    if (!menu) return;

    if (menu.classList.contains('open')) {
      menu.classList.add('close');
      iconMenu.classList.remove('icon-closed');
      setTimeout(() => {
        menu.classList.remove('open');
      }, 1300);
    } else {
      menu.classList.remove('close');
      menu.classList.add('open');
      iconMenu.classList.add('icon-closed');
    }
  }

  private openSubmenu(event: MouseEvent): void {
    const currentTarget = event.currentTarget as HTMLElement;
    if (currentTarget.classList.contains('active')) {
      currentTarget.classList.remove('active');
    } else {
      currentTarget.classList.add('active');
    }
  }
}
