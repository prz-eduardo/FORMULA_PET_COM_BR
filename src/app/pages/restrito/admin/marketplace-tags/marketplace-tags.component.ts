import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminPaginationComponent } from '../shared/admin-pagination/admin-pagination.component';
import { ButtonDirective, ButtonComponent } from '../../../../shared/button';
import { AdminApiService, MarketplaceTag } from '../../../../services/admin-api.service';
import { AdminCrudComponent } from '../../../../shared/admin-crud/admin-crud.component';

@Component({
  selector: 'app-admin-marketplace-tags',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AdminPaginationComponent, ButtonDirective, ButtonComponent, AdminCrudComponent],
  templateUrl: './marketplace-tags.component.html',
  styleUrls: ['./marketplace-tags.component.scss']
})
export class MarketplaceTagsAdminComponent implements OnInit {
  private api = inject(AdminApiService);
  private fb = inject(FormBuilder);

  rawList = signal<MarketplaceTag[]>([]);
  q = signal('');
  page = signal(1);
  pageSize = signal(15);
  loadingList = signal(false);
  submitting = signal(false);

  editingId = signal<number | null>(null);
  showCreate = signal(false);

  filteredList = computed(() => {
    const needle = this.q().trim().toLowerCase();
    const rows = this.rawList();
    if (!needle) return rows;
    return rows.filter((r) => {
      const nome = String(r.nome ?? '').toLowerCase();
      const id = String(r.id ?? '');
      return nome.includes(needle) || id.includes(needle);
    });
  });

  list = computed(() => {
    const all = this.filteredList();
    const start = (this.page() - 1) * this.pageSize();
    return all.slice(start, start + this.pageSize());
  });

  total = computed(() => this.filteredList().length);

  tagForm!: FormGroup;
  drawerOpen = computed(() => this.showCreate() || this.editingId() !== null);

  ngOnInit(): void {
    this.resetForm();
    this.loadList();
  }

  resetForm(det?: MarketplaceTag | null) {
    const d: MarketplaceTag = det || ({} as MarketplaceTag);
    this.tagForm = this.fb.group({
      nome: [d.nome || '', [Validators.required, Validators.minLength(1)]]
    });
  }

  resetEditor() {
    this.editingId.set(null);
    this.resetForm();
  }

  loadList() {
    this.loadingList.set(true);
    this.api.listMarketplaceTags().subscribe({
      next: (res) => {
        this.rawList.set(res.data || []);
        this.loadingList.set(false);
      },
      error: () => this.loadingList.set(false)
    });
  }

  onQuickSearch(term: string) {
    this.q.set(term);
    this.page.set(1);
  }

  novaTag() {
    this.resetEditor();
    this.showCreate.set(true);
  }

  editarTag(t: MarketplaceTag) {
    if (t.id == null) return;
    this.editingId.set(Number(t.id));
    this.showCreate.set(true);
    this.resetForm(t);
  }

  onDrawerOpenChange(open: boolean) {
    this.showCreate.set(open);
    if (!open) this.resetEditor();
  }

  closeDrawer() {
    this.resetEditor();
    this.showCreate.set(false);
  }

  submitTag() {
    if (this.tagForm.invalid) {
      this.tagForm.markAllAsTouched();
      return;
    }
    const nome = (this.tagForm.value.nome || '').trim();
    const id = this.editingId();
    this.submitting.set(true);
    if (id != null) {
      this.api.updateMarketplaceTag(id, { nome }).subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeDrawer();
          this.loadList();
        },
        error: () => this.submitting.set(false)
      });
    } else {
      this.api.createMarketplaceTag({ nome }).subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeDrawer();
          this.loadList();
        },
        error: () => this.submitting.set(false)
      });
    }
  }

  remover(t: MarketplaceTag) {
    if (t.id == null) return;
    if (!confirm(`Remover tag "${t.nome}"?`)) return;
    this.api.deleteMarketplaceTag(t.id).subscribe(() => this.loadList());
  }

  removerEditando() {
    const id = this.editingId();
    if (id == null) return;
    if (!confirm('Remover esta tag?')) return;
    this.api.deleteMarketplaceTag(id).subscribe(() => {
      this.closeDrawer();
      this.loadList();
    });
  }
}
