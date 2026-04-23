import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminPaginationComponent } from '../shared/admin-pagination/admin-pagination.component';
import { ButtonDirective, ButtonComponent } from '../../../../shared/button';
import { AdminApiService, MarketplaceCategoria } from '../../../../services/admin-api.service';
import { AdminCrudComponent } from '../../../../shared/admin-crud/admin-crud.component';

@Component({
  selector: 'app-admin-marketplace-categorias',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AdminPaginationComponent, ButtonDirective, ButtonComponent, AdminCrudComponent],
  templateUrl: './marketplace-categorias.component.html',
  styleUrls: ['./marketplace-categorias.component.scss']
})
export class MarketplaceCategoriasAdminComponent implements OnInit {
  private api = inject(AdminApiService);
  private fb = inject(FormBuilder);

  rawList = signal<MarketplaceCategoria[]>([]);
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
      const slug = String(r.slug ?? '').toLowerCase();
      const icone = String(r.icone ?? '').toLowerCase();
      const id = String(r.id ?? '');
      return nome.includes(needle) || slug.includes(needle) || icone.includes(needle) || id.includes(needle);
    });
  });

  list = computed(() => {
    const all = this.filteredList();
    const start = (this.page() - 1) * this.pageSize();
    return all.slice(start, start + this.pageSize());
  });

  total = computed(() => this.filteredList().length);

  categoriaForm!: FormGroup;
  drawerOpen = computed(() => this.showCreate() || this.editingId() !== null);

  ngOnInit(): void {
    this.resetForm();
    this.loadList();
  }

  resetForm(det?: MarketplaceCategoria | null) {
    const d: MarketplaceCategoria = det || ({} as MarketplaceCategoria);
    this.categoriaForm = this.fb.group({
      nome: [d.nome || '', [Validators.required, Validators.minLength(1)]],
      slug: [d.slug ?? ''],
      icone: [d.icone ?? '']
    });
  }

  resetEditor() {
    this.editingId.set(null);
    this.resetForm();
  }

  loadList() {
    this.loadingList.set(true);
    this.api.listMarketplaceCategorias().subscribe({
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

  novaCategoria() {
    this.resetEditor();
    this.showCreate.set(true);
  }

  editarCategoria(c: MarketplaceCategoria) {
    if (c.id == null) return;
    this.editingId.set(Number(c.id));
    this.showCreate.set(true);
    this.resetForm(c);
  }

  onDrawerOpenChange(open: boolean) {
    this.showCreate.set(open);
    if (!open) this.resetEditor();
  }

  closeDrawer() {
    this.resetEditor();
    this.showCreate.set(false);
  }

  submitCategoria() {
    if (this.categoriaForm.invalid) {
      this.categoriaForm.markAllAsTouched();
      return;
    }
    const v = this.categoriaForm.value;
    const slugVal = (v.slug || '').trim() || null;
    const iconeVal = (v.icone || '').trim() || null;
    const id = this.editingId();
    this.submitting.set(true);
    if (id != null) {
      this.api.updateMarketplaceCategoria(id, { nome: v.nome.trim(), slug: slugVal, icone: iconeVal }).subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeDrawer();
          this.loadList();
        },
        error: () => this.submitting.set(false)
      });
    } else {
      this.api.createMarketplaceCategoria({ nome: v.nome.trim(), slug: slugVal, icone: iconeVal }).subscribe({
        next: () => {
          this.submitting.set(false);
          this.closeDrawer();
          this.loadList();
        },
        error: () => this.submitting.set(false)
      });
    }
  }

  remover(c: MarketplaceCategoria) {
    if (c.id == null) return;
    if (!confirm(`Remover categoria "${c.nome}"?`)) return;
    this.api.deleteMarketplaceCategoria(c.id).subscribe(() => this.loadList());
  }

  removerEditando() {
    const id = this.editingId();
    if (id == null) return;
    if (!confirm('Remover esta categoria?')) return;
    this.api.deleteMarketplaceCategoria(id).subscribe(() => {
      this.closeDrawer();
      this.loadList();
    });
  }
}
