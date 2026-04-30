import { CommonModule } from '@angular/common';
import { Component, computed } from '@angular/core';
import { TenantLojaService } from '../../../services/tenant-loja.service';

@Component({
  selector: 'app-parceiro-institucional',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="wrap" *ngIf="tenant.isTenantLoja(); else noTenant">
      <h1>{{ titulo() }}</h1>
      <div class="body">{{ corpo() }}</div>
    </div>
    <ng-template #noTenant>
      <p class="wrap muted">Página disponível apenas na vitrine do parceiro.</p>
    </ng-template>
  `,
  styles: [
    `
      .wrap {
        max-width: 800px;
        margin: 0 auto;
        padding: 24px 16px 48px;
      }
      h1 {
        font-size: 26px;
        margin: 0 0 16px;
      }
      .body {
        line-height: 1.6;
        color: #334155;
        white-space: pre-wrap;
      }
      .muted {
        color: #64748b;
      }
    `,
  ],
})
export class ParceiroInstitucionalComponent {
  constructor(readonly tenant: TenantLojaService) {}

  readonly titulo = computed(() => this.tenant.profile()?.nome || 'Institucional');

  readonly corpo = computed(() => {
    const raw = this.tenant.profile()?.texto_institucional || this.tenant.profile()?.descricao || '';
    return String(raw || '');
  });
}
