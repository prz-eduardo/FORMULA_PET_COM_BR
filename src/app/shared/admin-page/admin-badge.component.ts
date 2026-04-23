import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Small badge/chip component. Variants: ok | info | warn | danger | muted.
 * Uses global .admin-badge tokens for styling.
 */
@Component({
  selector: 'app-admin-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="admin-badge" [ngClass]="variant"><ng-content></ng-content></span>
  `,
  styles: [`:host { display: inline-flex; }`]
})
export class AdminBadgeComponent {
  @Input() variant: 'ok' | 'info' | 'warn' | 'danger' | 'muted' | '' = '';
}
