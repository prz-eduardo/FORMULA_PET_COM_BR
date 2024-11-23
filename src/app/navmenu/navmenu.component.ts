import { Component, AfterViewInit, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-navmenu',
  standalone: true,
  imports: [],
  templateUrl: './navmenu.component.html',
  styleUrls: ['./navmenu.component.scss'] // Corrigido: `styleUrl` para `styleUrls`
})
export class NavmenuComponent implements AfterViewInit {
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngAfterViewInit(): void {
    // Certifica-se de que o código será executado apenas no navegador
    if (isPlatformBrowser(this.platformId)) {
      const iconMenu: HTMLElement | null = document.querySelector('.icon-menu');
      const menu: HTMLElement | null = document.querySelector('.menu');
      const menuLink: NodeListOf<HTMLElement> = document.querySelectorAll('.menu-link.sub');

      // Verifica se os elementos foram encontrados antes de adicionar eventos
      if (iconMenu && menu) {
        iconMenu.addEventListener('click', this.openMenu.bind(this, menu, iconMenu));

        menuLink.forEach((el) => {
          el.addEventListener('click', this.openSubmenu);
        });
      }
    }
  }

  // Função para abrir e fechar o menu
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

  // Função para abrir e fechar submenus
  private openSubmenu(event: MouseEvent): void {
    const currentTarget = event.currentTarget as HTMLElement;

    if (currentTarget.classList.contains('active')) {
      currentTarget.classList.remove('active');
    } else {
      currentTarget.classList.add('active');
    }
  }
}
