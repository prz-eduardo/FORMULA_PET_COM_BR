import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminPaginationComponent } from '../shared/admin-pagination/admin-pagination.component';
import { FormSchema } from '../../../../shared/admin-crud/form-schema';
import { AdminListingComponent } from '../../../../shared/admin-listing/admin-listing.component';
import { ButtonDirective } from '../../../../shared/button';
import { SideDrawerComponent } from '../../../../shared/side-drawer/side-drawer.component';
import { AdminCrudComponent } from '../../../../shared/admin-crud/admin-crud.component';
import { AdminApiService, Paged } from '../../../../services/admin-api.service';

@Component({
  selector: 'app-admin-ativos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, AdminPaginationComponent, ButtonDirective, AdminListingComponent, SideDrawerComponent, AdminCrudComponent],
  templateUrl: './ativos.component.html',
  styleUrls: ['./ativos.component.scss']
})
export class AtivosAdminComponent implements OnInit {
  q = signal('');
  active = signal<'all'|'1'|'0'>('all');
  page = signal(1);
  pageSize = signal(10);
  total = signal(0);
  items = signal<any[]>([]);
  loading = signal(false);

  selected = signal<any|null>(null);
  form!: FormGroup;
  @ViewChild('detailRef') detailRef!: ElementRef<HTMLElement>;
  @ViewChild('listRef') listRef!: ElementRef<HTMLElement>;
  searchDebounce: any = null;

  showCreate = signal(false);
  createForm!: FormGroup;

  // Columns and schema for standardized CRUD
  ativosColumns = [
    { key: 'id', label: 'ID', width: '60px' },
    { key: 'nome', label: 'Nome' },
    { key: 'active', label: 'Status', width: '120px', formatter: (it: any) => (it.active ? 'Ativo' : 'Inativo') }
  ];

  ativosFormSchema: FormSchema = {
    fields: [
      { key: 'nome', label: 'Nome', type: 'text', required: true },
      { key: 'descricao', label: 'Descrição', type: 'textarea' },
      { key: 'doseCaes', label: 'Dose (Cães)', type: 'textarea' },
      { key: 'doseGatos', label: 'Dose (Gatos)', type: 'textarea' },
      { key: 'active', label: 'Status', type: 'select', options: [{ value: 1, label: 'Ativo' }, { value: 0, label: 'Inativo' }], default: 1 }
    ],
    submitLabel: 'Salvar',
    title: 'Ativo'
  };


  constructor(private api: AdminApiService, private fb: FormBuilder) {}

  ngOnInit(): void {
    this.initCreateForm();
    this.load();
  }

  initCreateForm() {
    this.createForm = this.fb.group({
      nome: ['', [Validators.required, Validators.minLength(2)]],
      descricao: [''],
      doseCaes: [''],
      doseGatos: [''],
      active: [1]
    });
  }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page(), pageSize: this.pageSize() };
    if (this.q()) params.q = this.q();
    this.api.listAtivos(params).subscribe({
      next: (res: Paged<any>) => { this.items.set(res.data || []); this.total.set(res.total || 0); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  onQ(ev: Event) {
    const el = ev.target as HTMLInputElement|null; if (!el) return;
    this.q.set(el.value);
    this.page.set(1);
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.load(), 300);
  }

  onActive(ev: Event) { const el = ev.target as HTMLSelectElement|null; if (el) { this.active.set(el.value as any); this.page.set(1); this.load(); } }
  totalPages() { const s=this.pageSize(); const t=this.total(); return s? Math.max(1, Math.ceil(t/s)) : 1; }
  canPrev() { return this.page()>1; }
  canNext() { return this.page()<this.totalPages(); }
  prev() { if (this.canPrev()) { this.page.set(this.page()-1); this.load(); } }
  next() { if (this.canNext()) { this.page.set(this.page()+1); this.load(); } }

  pages(): Array<number|string> {
    const total = this.totalPages();
    const current = this.page();
    const delta = 2; // how many pages to show around current
    if (total <= 1) return [1];
    // small totals, show all
    if (total <= 7) return Array.from({length: total}, (_,i) => i+1);
    const range: Array<number|string> = [];
    const left = Math.max(2, current - delta);
    const right = Math.min(total - 1, current + delta);
    range.push(1);
    if (left > 2) range.push('...');
    for (let i = left; i <= right; i++) range.push(i);
    if (right < total - 1) range.push('...');
    range.push(total);
    return range;
  }

  selectPage(n: number|string) {
    if (typeof n !== 'number') return;
    if (n === this.page()) return;
    this.page.set(n);
    this.load();
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
  }

  goFirst() { if (!this.canPrev()) return; this.page.set(1); this.load(); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch(e){} }
  goLast() { const t = this.totalPages(); if (!this.canNext()) return; this.page.set(t); this.load(); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch(e){} }

  view(item: any) {
    this.selected.set(item);
    this.form = this.fb.group({
      nome: [item.nome, [Validators.required, Validators.minLength(2)]],
      descricao: [item.descricao || ''],
      doseCaes: [item.doseCaes || ''],
      doseGatos: [item.doseGatos || ''],
      active: [item.active ?? 1]
    });
    setTimeout(() => {
      try { this.detailRef?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }); } catch(e){}
    }, 50);
  }

  closeDetail() { this.selected.set(null); }

  save() {
    const s = this.selected(); if (!s || !this.form || this.form.invalid) { this.form?.markAllAsTouched(); return; }
    const payload = { ...this.form.value } as any;
    this.api.updateAtivo(s.id!, payload).subscribe(updated => {
      this.items.set(this.items().map(x => x.id === updated.id ? { ...x, ...updated } : x));
      // If the item was inactivated, close detail and focus the list
      if (Object.prototype.hasOwnProperty.call(updated, 'active') && Number(updated.active) === 0) {
        this.selected.set(null);
        setTimeout(() => {
          try {
            this.listRef?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            this.listRef?.nativeElement?.focus();
          } catch (e) {}
        }, 80);
      } else {
        this.selected.set(updated);
      }
    })
  }

  remove() {
    const s = this.selected(); if (!s) return;
    if (!confirm('Remover ativo?')) return;
    this.api.deleteAtivo(s.id!).subscribe(() => { this.selected.set(null); this.load(); })
  }

  openCreate() { this.showCreate.set(true); this.initCreateForm(); }
  cancelCreate() { this.showCreate.set(false); }
  create() {
    if (this.createForm.invalid) { this.createForm.markAllAsTouched(); return; }
    const payload = { ...this.createForm.value } as any;
    this.api.createAtivo(payload).subscribe(created => {
      this.showCreate.set(false);
      this.page.set(1);
      this.load();
      setTimeout(() => this.view(created), 0);
    })
  }

  // New: open create via schema-driven form
  openCreateForSchema() {
    this.selected.set(null);
    this.showCreate.set(true);
  }

  // New: handle submit from schema-driven form
  onSchemaSubmit(ev: { id?: any; values: any }) {
    const id = ev.id;
    const body = ev.values;
    if (id) {
      this.api.updateAtivo(id, body).subscribe((updated: any) => {
        this.items.set(this.items().map(x => x.id === updated.id ? { ...x, ...updated } : x));
        this.selected.set(updated);
        this.load();
      });
    } else {
      this.api.createAtivo(body).subscribe((created: any) => {
        this.showCreate.set(false);
        this.page.set(1);
        this.load();
        setTimeout(() => this.view(created), 0);
      });
    }
  }

  removeFromTable(item: any) {
    if (!item?.id) return;
    if (!confirm('Remover ativo?')) return;
    this.api.deleteAtivo(item.id).subscribe(() => this.load());
  }

  onDrawerOpenChange(open: boolean) {
    // When the drawer is closed by external control, ensure local states are cleared
    if (!open) {
      try { this.showCreate.set(false); } catch (e) {}
      try { this.selected.set(null); } catch (e) {}
    }
  }
}
