import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ColumnDef } from './form-schema';
import { AdminEmptyStateComponent } from './admin-empty-state.component';

/**
 * Declarative admin data table.
 * Use [columns] to describe columns and [items] for the rows.
 * Each row renders default actions (Detalhes / Remover) + any
 * page-specific custom actions emitted through (customAction).
 */
@Component({
  selector: 'app-admin-table',
  standalone: true,
  imports: [CommonModule, AdminEmptyStateComponent],
  template: `
    <div class="admin-table-wrap">
      <ng-container *ngIf="loading; else tableOrEmpty">
        <div class="admin-table-loading">Carregando...</div>
      </ng-container>

      <ng-template #tableOrEmpty>
        <ng-container *ngIf="items?.length; else emptyTpl">
          <table class="admin-table">
            <thead>
              <tr>
                <th *ngFor="let col of columns" [style.width]="col.width">{{ col.label || col.key }}</th>
                <th *ngIf="showActions">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of items">
                <td *ngFor="let col of columns" [ngClass]="col.class">
                  <ng-container *ngIf="isActiveColumn(col.key); else normalCell">
                    <div class="active-cell">
                      <button
                        class="switch readonly"
                        [class.on]="isActive(item)"
                        disabled
                        [attr.aria-pressed]="isActive(item)"
                        [attr.aria-label]="isActive(item) ? 'Ativo' : 'Inativo'"></button>
                    </div>
                  </ng-container>
                  <ng-template #normalCell>
                    <span>{{ col.formatter ? col.formatter(item) : item[col.key] }}</span>
                  </ng-template>
                </td>
                <td *ngIf="showActions" class="actions-cell">
                  <button class="admin-btn secondary small" type="button" (click)="edit.emit(item)">Detalhes</button>
                  <ng-container *ngFor="let a of extraActions">
                    <button
                      *ngIf="!a.showIf || a.showIf(item)"
                      [class]="'admin-btn small ' + (a.variant || 'secondary')"
                      type="button"
                      (click)="$event.stopPropagation(); customAction.emit({ action: a.key, item })"
                    >{{ a.label }}</button>
                  </ng-container>
                  <button *ngIf="allowRemove" class="admin-btn danger small" type="button" (click)="remove.emit(item)">Remover</button>
                </td>
              </tr>
            </tbody>
          </table>
        </ng-container>
        <ng-template #emptyTpl>
          <app-admin-empty-state [title]="emptyTitle" [description]="emptyDescription"></app-admin-empty-state>
        </ng-template>
      </ng-template>
    </div>
  `,
  styleUrls: ['./admin-table.component.scss']
})
export class AdminTableComponent {
  @Input() columns: ColumnDef[] = [];
  @Input() items: any[] = [];
  @Input() loading = false;
  @Input() showActions = true;
  @Input() allowRemove = true;
  /** custom row actions (rendered between "Detalhes" and "Remover") */
  @Input() extraActions: Array<{
    key: string;
    label: string;
    variant?: 'primary' | 'secondary' | 'danger' | 'warn' | 'ok' | 'outline';
    showIf?: (item: any) => boolean;
  }> = [];
  @Input() emptyTitle = 'Nenhum resultado encontrado';
  @Input() emptyDescription = '';

  @Output() edit = new EventEmitter<any>();
  @Output() remove = new EventEmitter<any>();
  @Output() customAction = new EventEmitter<{ action: string; item: any }>();

  private activeKeys = ['ativo', 'active', 'enabled'];

  isActiveColumn(key: string): boolean {
    if (!key) return false;
    try { return this.activeKeys.includes(key.toString().toLowerCase()); } catch { return false; }
  }

  isActive(item: any): boolean {
    if (!item) return false;
    if (item.ativo !== undefined) return item.ativo === 1 || item.ativo === true;
    if (item.active !== undefined) return item.active === 1 || item.active === true;
    if (item.enabled !== undefined) return item.enabled === 1 || item.enabled === true;
    return false;
  }
}
