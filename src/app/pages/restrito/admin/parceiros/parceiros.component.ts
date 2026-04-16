import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminApiService, AdminFornecedorDto, PartnerTypeDto, Paged } from '../../../../services/admin-api.service';

@Component({
  selector: 'app-admin-parceiros',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './parceiros.component.html',
  styleUrls: ['./parceiros.component.scss']
})
export class ParceirosAdminComponent implements OnInit {
  q = signal('');
  active = signal<'all'|'1'|'0'>('all');
  page = signal(1);
  pageSize = signal(10);
  total = signal(0);
  items = signal<AdminFornecedorDto[]>([]);
  loading = signal(false);

  selected = signal<AdminFornecedorDto|null>(null);
  form!: FormGroup;

  partnerTypes = signal<PartnerTypeDto[]>([]);
  showTypes = signal(false);

  showCreate = signal(false);
  createForm!: FormGroup;

  constructor(private api: AdminApiService, private fb: FormBuilder) {}

  ngOnInit(): void {
    this.initCreateForm();
    this.load();
    this.loadPartnerTypes();
  }

  initCreateForm() {
    this.createForm = this.fb.group({
      nome: ['', [Validators.required, Validators.minLength(2)]],
      cnpj: [''],
      contato: [''],
      email: ['', Validators.email],
      telefone: [''],
      tipo: [''],
      endereco: [''],
      numero: [''],
      complemento: [''],
      latitude: [''],
      longitude: [''],
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
      tipo: [item.tipo ?? ''],
      endereco: [item.endereco || ''],
      numero: [item.numero || ''],
      complemento: [item.complemento || ''],
      latitude: [item.latitude || ''],
      longitude: [item.longitude || ''],
      obs: [item.obs || ''],
      ativo: [item.ativo ?? 1]
    });
  }

  closeDetail() { this.selected.set(null); }

  save() {
    const s = this.selected(); if (!s || !this.form || this.form.invalid) { this.form?.markAllAsTouched(); return; }
    const payload = { ...this.form.value } as any;
    if (payload.cnpj) payload.cnpj = this.digitsOnly(payload.cnpj);
    if (payload.latitude) payload.latitude = Number(payload.latitude);
    if (payload.longitude) payload.longitude = Number(payload.longitude);
    this.api.updateAdminFornecedor(s.id!, payload).subscribe(updated => {
      this.items.set(this.items().map(x => x.id === updated.id ? { ...x, ...updated } : x));
      this.selected.set(updated);
    })
  }

  remove() {
    const s = this.selected(); if (!s) return;
    if (!confirm('Remover parceiro?')) return;
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
    if (payload.latitude) payload.latitude = Number(payload.latitude);
    if (payload.longitude) payload.longitude = Number(payload.longitude);
    this.api.createAdminFornecedor(payload).subscribe(created => {
      this.showCreate.set(false);
      this.page.set(1);
      this.load();
      setTimeout(() => this.view(created), 0);
    })
  }

  // Partner types management
  loadPartnerTypes() {
    this.api.listPartnerTypes().subscribe({ next: (res) => { this.partnerTypes.set(res || []); }, error: () => {} });
  }

  openTypes() { this.showTypes.set(true); this.loadPartnerTypes(); }
  closeTypes() { this.showTypes.set(false); }

  createType(name: string) {
    if (!name || !name.trim()) return;
    this.api.createPartnerType(name.trim()).subscribe(() => this.loadPartnerTypes());
  }

  updateType(id: any, name: string) {
    if (!id) return;
    this.api.updatePartnerType(id, name).subscribe(() => this.loadPartnerTypes());
  }

  deleteType(id: any) {
    if (!confirm('Remover tipo?')) return;
    this.api.deletePartnerType(id).subscribe(() => this.loadPartnerTypes());
  }

  // Interactive edit using browser prompt (wrapped to satisfy template type checking)
  editType(t: PartnerTypeDto) {
    try {
      const name = window.prompt('Novo nome', t.name || '');
      if (name == null) return; // cancelled
      const trimmed = (name || '').trim();
      if (!trimmed) return;
      this.updateType(t.id, trimmed);
    } catch (e) {
      // ignore
    }
  }

  // Approve / toggle active
  approveSelected() {
    const s = this.selected(); if (!s) return;
    const payload: any = { status: 'approved', ativo: 1 };
    this.api.updateAdminFornecedor(s.id!, payload).subscribe(u => { this.selected.set(u); this.load(); });
  }

  toggleActive() {
    const s = this.selected(); if (!s) return;
    const next = (s.ativo ?? 1) === 1 ? 0 : 1;
    const payload: any = { ativo: next };
    this.api.updateAdminFornecedor(s.id!, payload).subscribe(u => { this.selected.set(u); this.items.set(this.items().map(x => x.id === u.id ? { ...x, ...u } : x)); });
  }

  // CNPJ helpers
  digitsOnly(v: string): string { return (v || '').replace(/\D+/g, '').slice(0,14); }
  formatCnpjDisplay(v?: string | null): string {
    const d = this.digitsOnly(v || '');
    const p = [d.slice(0,2), d.slice(2,5), d.slice(5,8), d.slice(8,12), d.slice(12,14)].filter(Boolean);
    if (p.length === 0) return '';
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
