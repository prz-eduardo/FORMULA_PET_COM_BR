import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminApiService, AdminPetRow, Paged } from '../../../../services/admin-api.service';
import { AdminPaginationComponent } from '../shared/admin-pagination/admin-pagination.component';

@Component({
  selector: 'app-admin-pets-galeria',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdminPaginationComponent],
  templateUrl: './pets-galeria.component.html',
  styleUrls: ['./pets-galeria.component.scss'],
})
export class PetsGaleriaAdminComponent implements OnInit {
  q = signal('');
  aprovado: 'all' | 'pending' | 'approved' = 'all';
  galeria: 'all' | 'yes' | 'no' = 'all';
  page = signal(1);
  pageSize = signal(20);
  total = signal(0);
  items = signal<AdminPetRow[]>([]);
  loading = signal(false);
  savingId = signal<number | null>(null);

  constructor(private api: AdminApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api
      .listAdminPets({
        page: this.page(),
        pageSize: this.pageSize(),
        q: this.q().trim() || undefined,
        aprovado: this.aprovado,
        galeria: this.galeria,
      })
      .subscribe({
        next: (res: Paged<AdminPetRow>) => {
          this.items.set(res.data || []);
          this.total.set(res.total || 0);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onSearchInput(ev: Event) {
    const v = (ev.target as HTMLInputElement).value;
    this.q.set(v);
    this.page.set(1);
    this.load();
  }

  onFilterChange() {
    this.page.set(1);
    this.load();
  }

  onPageChange(p: number) {
    this.page.set(p);
    this.load();
  }

  onPageSizeChange(ev: Event) {
    const n = Number((ev.target as HTMLSelectElement).value) || 20;
    this.pageSize.set(n);
    this.page.set(1);
    this.load();
  }

  isApproved(row: AdminPetRow): boolean {
    const v = row.aprovado_por_admin;
    return v === 1 || v === true;
  }

  wantsGallery(row: AdminPetRow): boolean {
    const v = row.exibir_galeria_publica;
    return v === 1 || v === true;
  }

  visibleInPublicGallery(row: AdminPetRow): boolean {
    return this.isApproved(row) && this.wantsGallery(row);
  }

  setApproved(row: AdminPetRow, approved: boolean) {
    this.savingId.set(row.id);
    this.api.patchAdminPet(row.id, { aprovado_por_admin: approved ? 1 : 0 }).subscribe({
      next: (updated) => {
        this.patchRow(updated);
        this.savingId.set(null);
      },
      error: () => this.savingId.set(null),
    });
  }

  setGaleria(row: AdminPetRow, on: boolean) {
    this.savingId.set(row.id);
    this.api.patchAdminPet(row.id, { exibir_galeria_publica: on ? 1 : 0 }).subscribe({
      next: (updated) => {
        this.patchRow(updated);
        this.savingId.set(null);
      },
      error: () => this.savingId.set(null),
    });
  }

  private patchRow(updated: AdminPetRow) {
    this.items.set(
      this.items().map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
    );
  }
}
