import { Directive, Input, HostBinding, ElementRef, Renderer2, OnInit } from '@angular/core';

@Directive({
  selector: 'button, [appBtn]',
  standalone: true
})
export class ButtonDirective implements OnInit {
  // Accept attribute-only usage (`appBtn`) which Angular passes as an empty string,
  // boolean bindings, or explicit variant strings. Normalize to internal `_variant`.
  @Input('appBtn') set appBtn(v: unknown) {
    if (v === null || v === undefined) { this._variant = undefined; return; }
    if (typeof v === 'boolean') { this._variant = undefined; return; }
    if (typeof v === 'string') {
      const trimmed = v.trim();
      this._variant = trimmed || undefined;
      return;
    }
    // fallback
    this._variant = String(v);
  }

  // Use a setter so the disabled attribute is updated every time the binding changes,
  // not just once at ngOnInit. Angular's [disabled] binding invokes this setter on
  // every change detection cycle when the value changes.
  @Input() set disabled(v: boolean) {
    this._disabled = v;
    if (this.el) {
      if (v) {
        this.renderer.setAttribute(this.el.nativeElement, 'disabled', 'true');
      } else {
        this.renderer.removeAttribute(this.el.nativeElement, 'disabled');
      }
    }
  }
  get disabled() { return this._disabled; }
  private _disabled = false;

  @HostBinding('class.app-btn') base = true;
  @HostBinding('class.primary') get isPrimary() { return this._variant === 'primary'; }
  @HostBinding('class.ghost') get isGhost() { return this._variant === 'ghost' || this._variant === 'outline' || this._variant === 'link'; }
  @HostBinding('class.danger') get isDanger() { return this._variant === 'danger' || this._variant === 'warn'; }
  @HostBinding('class.secondary') get isSecondary() { return this._variant === 'secondary'; }

  private _variant: string | undefined;

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  ngOnInit() {
    const classList = (this.el.nativeElement as HTMLElement).classList;
    // prefer explicit input variant
    if (!this._variant) {
      if (classList.contains('ghost') || classList.contains('outline') || classList.contains('link')) this._variant = 'ghost';
      else if (classList.contains('danger') || classList.contains('warn')) this._variant = 'danger';
      else if (classList.contains('secondary') || classList.contains('btn-sec' ) || classList.contains('btn-secundario')) this._variant = 'secondary';
      else if (classList.contains('primary') || classList.contains('btn') || classList.contains('btn-primary')) this._variant = 'primary';
    }

    // ensure base class exists
    this.renderer.addClass(this.el.nativeElement, 'app-btn');
    if (this._variant) this.renderer.addClass(this.el.nativeElement, this._variant);
    // apply initial disabled state (setter may have fired before el was ready)
    if (this._disabled) {
      this.renderer.setAttribute(this.el.nativeElement, 'disabled', 'true');
    } else {
      this.renderer.removeAttribute(this.el.nativeElement, 'disabled');
    }
  }
}
