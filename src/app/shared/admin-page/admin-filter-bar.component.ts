import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Thin visual wrapper for filter controls. Pages project selects/inputs
 * inside and the bar handles the spacing + responsive wrap.
 */
@Component({
  selector: 'app-admin-filter-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="admin-filter-bar">
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .admin-filter-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }
    .admin-filter-bar select,
    .admin-filter-bar input {
      padding: 8px 10px;
      border-radius: var(--admin-radius-md);
      border: 1px solid var(--admin-border-strong);
      background: var(--admin-input-bg);
      color: var(--admin-text);
      outline: none;
      min-width: 140px;
    }
    .admin-filter-bar select:focus,
    .admin-filter-bar input:focus {
      border-color: var(--admin-focus-border);
      box-shadow: var(--admin-focus-ring);
    }
  `]
})
export class AdminFilterBarComponent {}
