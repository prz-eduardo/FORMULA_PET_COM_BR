import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, Output, Renderer2, ViewChild, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-side-drawer',
  standalone: true,
  imports: [CommonModule],
  template: `
<div *ngIf="rendered" class="create-drawer sd-overlay" [class.open]="isOpen" [class.left]="position==='left'" [class.full]="full" (click)="onBackdropClick($event)" role="presentation">
  <div class="drawer" #drawer [style.width]="width" role="dialog" aria-modal="true" (click)="$event.stopPropagation()" (transitionend)="onTransitionEnd($event)">
    <ng-content></ng-content>
  </div>
</div>
  `,
  styleUrls: ['./side-drawer.component.scss']
})
export class SideDrawerComponent implements AfterViewInit, OnDestroy {
  @Input() width = '520px';
  @Input() full = false;
  @Input() position: 'right' | 'left' = 'right';
  @Input() backdropClose = true;
  @Input() animationDurationMs = 240;

  // use a setter so external bindings work well
  private _open = false;
  @Input()
  set open(v: boolean) {
    if (v === this._open) return;
    this._open = v;
    if (v) this.show(); else this.hide();
    this.openChange.emit(v);
  }
  get open() { return this._open; }

  @Output() openChange = new EventEmitter<boolean>();
  @Output() closeRequest = new EventEmitter<'backdrop'|'esc'|'programmatic'>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('drawer', { static: false, read: ElementRef }) drawerRef?: ElementRef<HTMLElement>;

  rendered = false; // keep overlay in DOM while animating
  isOpen = false; // toggles open class

  private prevFocused: HTMLElement | null = null;
  private keyHandler?: (e: KeyboardEvent) => void;
  private lockedScrollY: number | null = null;

  constructor(private host: ElementRef, private renderer: Renderer2) {}

  ngAfterViewInit(): void {
    try {
      if (this.host && this.host.nativeElement && this.host.nativeElement.parentNode !== document.body) {
        this.renderer.appendChild(document.body, this.host.nativeElement);
      }
    } catch (e) {}
    if (this._open) this.show();
  }

  ngOnDestroy(): void {
    this.removeKeyListener();
    this.enableScroll();
    try {
      if (this.host && this.host.nativeElement && this.host.nativeElement.parentNode === document.body) {
        this.renderer.removeChild(document.body, this.host.nativeElement);
      }
    } catch (e) {}
  }

  private show() {
    this.prevFocused = document.activeElement as HTMLElement | null;
    this.rendered = true;
    // allow DOM to render then add open class
    requestAnimationFrame(() => {
      this.isOpen = true;
      this.addKeyListener();
      this.resetInternalScroll();
      // focus the drawer (basic focus management)
      setTimeout(() => this.focusDrawer(), 50);
    });
    this.disableScroll();
  }

  private hide() {
    this.isOpen = false;
    this.removeKeyListener();
    this.enableScroll();
    // do not set rendered=false here; wait for transitionend to fire
  }

  onBackdropClick(ev: MouseEvent) {
    if (!this.backdropClose) return;
    this.requestClose('backdrop');
  }

  requestClose(kind: 'backdrop'|'esc'|'programmatic' = 'programmatic') {
    this.closeRequest.emit(kind);
    // parent may decide to set open=false; but also honor programmatic close
    this.open = false;
  }

  onTransitionEnd(ev: TransitionEvent) {
    // wait for transform transition on drawer
    if (ev.propertyName !== 'transform') return;
    if (!this.isOpen) {
      this.rendered = false;
      try { this.prevFocused?.focus(); } catch (e) {}
      this.closed.emit();
    }
  }

  private focusDrawer() {
    try {
      const el = this.drawerRef?.nativeElement || (this.host && this.host.nativeElement.querySelector('.drawer'));
      if (el) {
        (el as HTMLElement).setAttribute('tabindex', '-1');
        (el as HTMLElement).focus();
      }
    } catch (e) {}
  }

  private addKeyListener() {
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.stopPropagation();
        this.requestClose('esc');
      }
    };
    document.addEventListener('keydown', this.keyHandler as any);
  }

  private removeKeyListener() {
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler as any);
      this.keyHandler = undefined;
    }
  }

  private disableScroll() {
    try {
      // Use fixed positioning to lock background scroll while keeping
      // the drawer scrollable on iOS/Android. Store current scroll position
      // so we can restore it when the drawer closes.
      this.lockedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${this.lockedScrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
    } catch (e) {}
  }

  private enableScroll() {
    try {
      // Restore previous body positioning and scroll position.
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      if (this.lockedScrollY !== null) {
        window.scrollTo(0, this.lockedScrollY);
        this.lockedScrollY = null;
      }
    } catch (e) {}
  }

  private resetInternalScroll() {
    try {
      const drawerEl: HTMLElement | null = this.drawerRef?.nativeElement || (this.host && this.host.nativeElement.querySelector('.drawer'));
      if (!drawerEl) return;
      // reset main drawer scroll
      try { drawerEl.scrollTop = 0; } catch (e) {}
      // reset common internal scrollable areas
      const selectors = ['.content-grid', '.right', '.card-body', '.segment-body', '.items-grid'];
      selectors.forEach(sel => {
        try {
          const el = drawerEl.querySelector(sel) as HTMLElement | null;
          if (el) el.scrollTop = 0;
        } catch (e) {}
      });
      // reset any other scrollable nodes
      try {
        const nodes = Array.from(drawerEl.querySelectorAll<HTMLElement>('[data-scroll], .sd-scroll, .scrollable')) as HTMLElement[];
        nodes.forEach(n => { try { n.scrollTop = 0; } catch (e) {} });
      } catch (e) {}
    } catch (e) {}
  }
}
