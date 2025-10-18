import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminApiService, AdminFornecedorDto, Paged } from '../../../../services/admin-api.service';

@Component({
  selector: 'app-admin-fornecedores',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './fornecedores.component.html',
  styleUrls: ['./fornecedores.component.scss']
})
export class FornecedoresAdminComponent implements OnInit {
  q = signal('');
  active = signal<'all'|'1'|'0'>('all');
  page = signal(1);
  pageSize = signal(10);
  total = signal(0);
  items = signal<AdminFornecedorDto[]>([]);
  loading = signal(false);

  selected = signal<AdminFornecedorDto|null>(null);
  form!: FormGroup;

  showCreate = signal(false);
  createForm!: FormGroup;

  constructor(private api: AdminApiService, private fb: FormBuilder) {}

  ngOnInit(): void {
    this.initCreateForm();
    this.load();
  }

  initCreateForm() {
    this.createForm = this.fb.group({
      nome: ['', [Validators.required, Validators.minLength(2)]],
      cnpj: [''],
      contato: [''],
      email: ['', Validators.email],
      telefone: [''],
      endereco: [''],
      obs: [''],
      ativo: [1]
    });
  }

  load() {
    this.loading.set(true);
    const params: any = { q: this.q(), page: this.page(), pageSize: this.pageSize() };
    if (this.active() !== 'all') params.active = this.active() === '1' ? 1 : 0;
    this.api.listAdminFornecedores(params).subscribe({
      next: (res: Paged<AdminFornecedorDto>) => {
        this.items.set(res.data || []);
        this.total.set(res.total || 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    })
  }

  onQ(ev: Event) { const el = ev.target as HTMLInputElement|null; if (el) { this.q.set(el.value); this.page.set(1); this.load(); } }
  onActive(ev: Event) { const el = ev.target as HTMLSelectElement|null; if (el) { this.active.set(el.value as any); this.page.set(1); this.load(); } }
  totalPages() { const s=this.pageSize(); const t=this.total(); return s? Math.max(1, Math.ceil(t/s)) : 1; }
  canPrev() { return this.page()>1; }
  canNext() { return this.page()<this.totalPages(); }
  prev() { if (this.canPrev()) { this.page.set(this.page()-1); this.load(); } }
  next() { if (this.canNext()) { this.page.set(this.page()+1); this.load(); } }

  view(item: AdminFornecedorDto) {
    this.selected.set(item);
    this.form = this.fb.group({
      nome: [item.nome, [Validators.required, Validators.minLength(2)]],
      cnpj: [this.formatCnpjDisplay(item.cnpj || '')],
      contato: [item.contato || ''],
      email: [item.email || '', Validators.email],
      telefone: [item.telefone || ''],
      endereco: [item.endereco || ''],
      obs: [item.obs || ''],
      ativo: [item.ativo ?? 1]
    });
  }

  closeDetail() { this.selected.set(null); }

  save() {
    const s = this.selected(); if (!s || !this.form || this.form.invalid) { this.form?.markAllAsTouched(); return; }
    const payload = { ...this.form.value } as any;
    if (payload.cnpj) payload.cnpj = this.digitsOnly(payload.cnpj);
    this.api.updateAdminFornecedor(s.id!, payload).subscribe(updated => {
      this.items.set(this.items().map(x => x.id === updated.id ? { ...x, ...updated } : x));
      this.selected.set(updated);
    })
  }

  remove() {
    const s = this.selected(); if (!s) return;
    if (!confirm('Remover fornecedor?')) return;
    this.api.deleteAdminFornecedor(s.id!).subscribe(() => {
      this.selected.set(null);
      this.load();
    })
  }

  openCreate() { this.showCreate.set(true); this.initCreateForm(); }
  cancelCreate() { this.showCreate.set(false); }
  create() {
    if (this.createForm.invalid) { this.createForm.markAllAsTouched(); return; }
    const payload = { ...this.createForm.value } as any;
    if (payload.cnpj) payload.cnpj = this.digitsOnly(payload.cnpj);
    this.api.createAdminFornecedor(payload).subscribe(created => {
      this.showCreate.set(false);
      this.page.set(1);
      this.load();
      setTimeout(() => this.view(created), 0);
    })
  }

  // CNPJ helpers
  digitsOnly(v: string): string { return (v || '').replace(/\D+/g, '').slice(0,14); }
  formatCnpjDisplay(v?: string | null): string {
    const d = this.digitsOnly(v || '');
    const p = [d.slice(0,2), d.slice(2,5), d.slice(5,8), d.slice(8,12), d.slice(12,14)].filter(Boolean);
    if (p.length === 0) return '';
    // 00.000.000/0000-00
    let out = '';
    if (p[0]) out += p[0];
    if (p[1]) out += '.' + p[1];
    if (p[2]) out += '.' + p[2];
    if (p[3]) out += '/' + p[3];
    if (p[4]) out += '-' + p[4];
    return out;
  }
  blockNonDigits(ev: KeyboardEvent) {
    const allowed = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'];
    if (allowed.includes(ev.key)) return;
    if (!/^[0-9]$/.test(ev.key)) ev.preventDefault();
  }
  onCnpjInput(ev: Event, ctx: 'edit'|'create') {
    const el = ev.target as HTMLInputElement | null; if (!el) return;
    const masked = this.formatCnpjDisplay(el.value);
    el.value = masked;
    if (ctx === 'edit') this.form?.get('cnpj')?.setValue(masked, { emitEvent: false });
    else this.createForm?.get('cnpj')?.setValue(masked, { emitEvent: false });
  }
}
