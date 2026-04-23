import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Standard admin toolbar: title + search + filters + primary action.
 * Pages can either use the standard layout via inputs, or project
 * custom content through the named slots.
 *
 * Slots:
 *  - [slot=title]       title / heading
 *  - [slot=search]      custom search control(s)
 *  - [slot=filters]     filter chips / selects (shown below or next to search)
 *  - [slot=actions]     extra action buttons (left of the primary)
 */
@Component({
  selector: 'app-admin-toolbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="admin-toolbar">
      <div class="tb-title">
        <ng-content select="[slot=title]"></ng-content>
      </div>

      <div class="tb-controls">
        <div class="tb-search">
          <ng-content select="[slot=search]"></ng-content>
          <input
            *ngIf="useDefaultSearch"
            class="admin-search-input"
            type="search"
            [placeholder]="searchPlaceholder"
            (input)="emitQuickSearch($event)"
          />
        </div>

        <div class="tb-filters">
          <ng-content select="[slot=filters]"></ng-content>
        </div>

        <div class="tb-actions">
          <ng-content select="[slot=actions]"></ng-content>
          <button
            *ngIf="useDefaultActions"
            class="admin-btn"
            type="button"
            (click)="create.emit()"
          >{{ createLabel }}</button>
        </div>
      </div>
    </header>
  `,
  styleUrls: ['./admin-toolbar.component.scss']
})
export class AdminToolbarComponent {
  @Input() useDefaultSearch = false;
  @Input() searchPlaceholder = 'Buscar...';
  @Input() useDefaultActions = false;
  @Input() createLabel = 'Novo';

  @Output() quickSearch = new EventEmitter<string>();
  @Output() create = new EventEmitter<void>();

  emitQuickSearch(ev: Event) {
    this.quickSearch.emit((ev.target as HTMLInputElement).value);
  }
}
