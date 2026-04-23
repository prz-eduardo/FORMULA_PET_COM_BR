import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Empty state / placeholder. Use the `title` + projected content for
 * a standard empty illustration style.
 */
@Component({
  selector: 'app-admin-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="admin-empty">
      <div *ngIf="icon" class="icon" aria-hidden="true">{{ icon }}</div>
      <div *ngIf="title" class="title">{{ title }}</div>
      <div *ngIf="description" class="desc">{{ description }}</div>
      <div class="extra"><ng-content></ng-content></div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .admin-empty .icon { font-size: 28px; margin-bottom: 8px; }
    .admin-empty .title { font-weight: 600; color: var(--admin-text); margin-bottom: 4px; }
    .admin-empty .desc { font-size: 13px; color: var(--admin-muted-2); }
    .admin-empty .extra { margin-top: 12px; display: flex; justify-content: center; gap: 8px; }
  `]
})
export class AdminEmptyStateComponent {
  @Input() title = 'Sem resultados';
  @Input() description = '';
  @Input() icon = '';
}
