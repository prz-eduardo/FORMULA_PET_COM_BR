import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SideDrawerComponent } from '../../../../../shared/side-drawer/side-drawer.component';

/**
 * AdminDrawerComponent standardizes the look & feel of the side drawer used
 * across every admin page. It wraps the low-level `app-side-drawer` and
 * imposes a fixed structure:
 *   - sticky header (title + optional subtitle + close button)
 *   - scrollable body (default content projection)
 *   - sticky footer (Cancelar / primary action)
 *
 * Pages that need a custom footer (e.g. pedidos with app-order-details) can
 * set `[hideFooter]="true"` or project `[slot=footer]`. Extra header controls
 * can be projected via `[slot=header-actions]`.
 */
@Component({
  selector: 'app-admin-drawer',
  standalone: true,
  imports: [CommonModule, SideDrawerComponent],
  templateUrl: './admin-drawer.component.html',
  styleUrls: ['./admin-drawer.component.scss']
})
export class AdminDrawerComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() subtitle?: string;
  @Input() width = '520px';
  @Input() full = false;
  @Input() position: 'right' | 'left' = 'right';
  @Input() backdropClose = true;

  @Input() primaryLabel = 'Salvar';
  @Input() secondaryLabel = 'Cancelar';
  @Input() primaryDisabled = false;
  @Input() primaryLoading = false;
  @Input() showPrimary = true;
  @Input() showSecondary = true;
  @Input() hideFooter = false;
  @Input() primaryType: 'button' | 'submit' = 'button';
  @Input() primaryForm?: string;

  @Output() openChange = new EventEmitter<boolean>();
  @Output() closeRequest = new EventEmitter<'backdrop' | 'esc' | 'programmatic'>();
  @Output() primaryAction = new EventEmitter<void>();
  @Output() secondaryAction = new EventEmitter<void>();

  onOpenChange(v: boolean) { this.openChange.emit(v); }
  onCloseRequest(kind: 'backdrop' | 'esc' | 'programmatic') { this.closeRequest.emit(kind); }
  onPrimary() { if (this.primaryDisabled || this.primaryLoading) return; this.primaryAction.emit(); }
  onSecondary() { this.secondaryAction.emit(); }
}
