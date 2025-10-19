import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminApiService, InsumoDto, Paged } from '../../../../services/admin-api.service';

@Component({
  selector: 'app-admin-insumos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './insumos.component.html',
  styleUrls: ['./insumos.component.scss']
})
export class InsumosAdminComponent implements OnInit {
  q = signal('');
  active = signal<'all'|'1'|'0'>('all');
  page = signal(1);
  pageSize = signal(10);
  total = signal(0);
  items = signal<InsumoDto[]>([]);
  loading = signal(false);

  selected = signal<InsumoDto|null>(null);
  form!: FormGroup;

  showCreate = signal(false);
  createForm!: FormGroup;

  units: Array<{ code: string; name: string }> = [];

  constructor(private api: AdminApiService, private fb: FormBuilder) {}

  ngOnInit(): void {
    this.initCreateForm();
    this.api.listUnits().subscribe(u => this.units = u || []);
    this.load();
  }

  initCreateForm() {
    this.createForm = this.fb.group({
      nome: ['', [Validators.required, Validators.minLength(2)]],
      descricao: [''],
      unit_code: [''],
      active: [1]
    });
  }

  load() {
    this.loading.set(true);
    const params: any = { q: this.q(), page: this.page(), pageSize: this.pageSize() };
    if (this.active() !== 'all') params.active = this.active() === '1' ? 1 : 0;
    this.api.listInsumos(params).subscribe({
      next: (res: Paged<InsumoDto>) => { this.items.set(res.data || []); this.total.set(res.total || 0); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  onQ(ev: Event) { const el = ev.target as HTMLInputElement|null; if (el) { this.q.set(el.value); this.page.set(1); this.load(); } }
  onActive(ev: Event) { const el = ev.target as HTMLSelectElement|null; if (el) { this.active.set(el.value as any); this.page.set(1); this.load(); } }
  totalPages() { const s=this.pageSize(); const t=this.total(); return s? Math.max(1, Math.ceil(t/s)) : 1; }
  canPrev() { return this.page()>1; }
  canNext() { return this.page()<this.totalPages(); }
  prev() { if (this.canPrev()) { this.page.set(this.page()-1); this.load(); } }
  next() { if (this.canNext()) { this.page.set(this.page()+1); this.load(); } }

  view(item: InsumoDto) {
    this.selected.set(item);
    this.form = this.fb.group({
      nome: [item.nome, [Validators.required, Validators.minLength(2)]],
      descricao: [item.descricao || ''],
      unit_code: [item.unit_code || ''],
      active: [item.active ?? 1]
    });
  }

  closeDetail() { this.selected.set(null); }

  save() {
    const s = this.selected(); if (!s || !this.form || this.form.invalid) { this.form?.markAllAsTouched(); return; }
    const payload = { ...this.form.value } as any;
    this.api.updateInsumo(s.id!, payload).subscribe(updated => {
      this.items.set(this.items().map(x => x.id === updated.id ? { ...x, ...updated } : x));
      this.selected.set(updated);
    })
  }

  remove() {
    const s = this.selected(); if (!s) return;
    if (!confirm('Remover insumo?')) return;
    this.api.deleteInsumo(s.id!).subscribe(() => { this.selected.set(null); this.load(); })
  }

  openCreate() { this.showCreate.set(true); this.initCreateForm(); }
  cancelCreate() { this.showCreate.set(false); }
  create() {
    if (this.createForm.invalid) { this.createForm.markAllAsTouched(); return; }
    const payload = { ...this.createForm.value } as any;
    this.api.createInsumo(payload).subscribe(created => {
      this.showCreate.set(false);
      this.page.set(1);
      this.load();
      setTimeout(() => this.view(created), 0);
    })
  }
}
