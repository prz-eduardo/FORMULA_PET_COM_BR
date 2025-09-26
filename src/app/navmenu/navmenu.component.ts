import { Component, AfterViewInit, Inject, PLATFORM_ID, HostListener } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-navmenu',
  standalone: true,
  imports: [RouterLink], // precisa pro [routerLink]
  templateUrl: './navmenu.component.html',
  styleUrls: ['./navmenu.component.scss']
})
export class NavmenuComponent implements AfterViewInit {
  previousScroll: number = 0;
  isVisible = true;
  currentRoute: string = '';

  constructor(@Inject(PLATFORM_ID) private platformId: Object, private router: Router) {}

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Inicializa a rota atual
      this.currentRoute = this.router.url;

      // Atualiza a rota ao navegar
      this.router.events
        .pipe(filter(event => event instanceof NavigationEnd))
        .subscribe((event: any) => {
          this.currentRoute = event.urlAfterRedirects;
        });

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
    if (isPlatformBrowser(this.platformId)) {
      const currentScroll = window.scrollY;
      this.isVisible = currentScroll < this.previousScroll;
      this.previousScroll = currentScroll;
    }
  }

  private openMenu(menu: HTMLElement, iconMenu: HTMLElement): void {
    if (!menu) return;
    if (menu.classList.contains('open')) {
      menu.classList.add('close');
      iconMenu.classList.remove('icon-closed');
      setTimeout(() => menu.classList.remove('open'), 1300);
    } else {
      menu.classList.remove('close');
      menu.classList.add('open');
      iconMenu.classList.add('icon-closed');
    }
  }

  private openSubmenu(event: MouseEvent): void {
    const currentTarget = event.currentTarget as HTMLElement;
    currentTarget.classList.toggle('active');
  }
}
