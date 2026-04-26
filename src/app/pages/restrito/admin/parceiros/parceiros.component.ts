import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminDrawerComponent } from '../shared/admin-drawer/admin-drawer.component';
import { ButtonDirective } from '../../../../shared/button';
import { AdminApiService, AdminParceiroDto, TipoProfissionalDto, Paged } from '../../../../services/admin-api.service';
import { ApiService } from '../../../../services/api.service';
import { AdminAddressComponent, buildAddressGroup, flattenAddress } from '../../../../shared/admin-address';

@Component({
  selector: 'app-admin-parceiros',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, AdminDrawerComponent, ButtonDirective, AdminAddressComponent],
  templateUrl: './parceiros.component.html',
  styleUrls: ['./parceiros.component.scss']
})
export class ParceirosAdminComponent implements OnInit {
  q = signal('');
  statusFilter = signal<'all'|'pending'|'approved'|'rejected'>('all');
  page = signal(1);
  pageSize = signal(10);
  total = signal(0);
  items = signal<AdminParceiroDto[]>([]);
  loading = signal(false);

  selected = signal<AdminParceiroDto|null>(null);
  expandedId = signal<number|null>(null);
  form!: FormGroup;

  tiposParceiro = signal<TipoProfissionalDto[]>([]);
  showTypes = signal(false);
  editingTipo = signal<TipoProfissionalDto|null>(null);
  tipoForm!: FormGroup;

  constructor(private api: AdminApiService, private publicApi: ApiService, private fb: FormBuilder) {}

  ngOnInit(): void {
    this.load();
    this.loadTipos();
  }

  load() {
    this.loading.set(true);
    const params: any = { q: this.q(), page: this.page(), pageSize: this.pageSize() };
    if (this.statusFilter() !== 'all') params.status = this.statusFilter();
    this.api.listAdminParceiros(params).subscribe({
      next: (res: Paged<AdminParceiroDto>) => {
        this.items.set(res.data || []);
        this.total.set(res.total || 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  loadTipos() {
    this.api.listTiposParceiro().subscribe({ next: (res) => this.tiposParceiro.set(res || []), error: () => {} });
  }

  onQ(ev: Event) { const el = ev.target as HTMLInputElement|null; if (el) { this.q.set(el.value); this.page.set(1); this.load(); } }
  onStatusFilter(ev: Event) { const el = ev.target as HTMLSelectElement|null; if (el) { this.statusFilter.set(el.value as any); this.page.set(1); this.load(); } }
  onSelectPageSize(ev: Event) { const el = ev.target as HTMLSelectElement|null; if (!el) return; this.pageSize.set(Number(el.value) || 10); this.page.set(1); this.load(); }
  totalPages() { const s = this.pageSize(); const t = this.total(); return s ? Math.max(1, Math.ceil(t/s)) : 1; }
  canPrev() { return this.page() > 1; }
  canNext() { return this.page() < this.totalPages(); }
  prev() { if (this.canPrev()) { this.page.set(this.page()-1); this.load(); } }
  next() { if (this.canNext()) { this.page.set(this.page()+1); this.load(); } }
  pageEnd(): number { return Math.min(this.page() * this.pageSize(), this.total()); }

  isExpanded(u: AdminParceiroDto): boolean { return u.id != null && u.id === this.expandedId(); }
  toggleExpand(u: AdminParceiroDto) { if (this.isExpanded(u)) { this.closeDetail(); } else { this.view(u); } }

  view(item: AdminParceiroDto) {
    this.selected.set(item);
    this.expandedId.set(item.id ?? null);
    this.form = this.fb.group({
      nome: [item.nome, [Validators.required, Validators.minLength(2)]],
      cpf_cnpj: [this.formatCpfCnpjDisplay(item.cpf_cnpj || '')],
      email: [item.email || '', Validators.email],
      telefone: [item.telefone || ''],
      tipo_id: [item.tipo_id ?? ''],
      descricao: [item.descricao || ''],
      latitude: [item.latitude ?? ''],
      longitude: [item.longitude ?? ''],
      address: buildAddressGroup(this.fb, {
        cep: item.cep ?? '',
        logradouro: item.endereco ?? '',
        numero: item.numero ?? '',
        complemento: item.complemento ?? '',
        bairro: item.bairro ?? '',
        city: item.cidade ?? '',
        uf: item.estado ?? ''
      })
    });
  }

  closeDetail() { this.selected.set(null); this.expandedId.set(null); }

  save() {
    const s = this.selected(); if (!s || !this.form || this.form.invalid) { this.form?.markAllAsTouched(); return; }
    const payload: any = flattenAddress(this.form.getRawValue());
    if (payload.cpf_cnpj) payload.cpf_cnpj = this.digitsOnly(payload.cpf_cnpj);
    if (payload.latitude) payload.latitude = Number(payload.latitude);
    if (payload.longitude) payload.longitude = Number(payload.longitude);
    payload.endereco = this.composeAddressLine(payload);
    this.api.updateAdminParceiro(s.id!, payload).subscribe(updated => {
      this.items.set(this.items().map(x => x.id === updated.id ? { ...x, ...updated } : x));
      this.selected.set({ ...(this.selected() as any), ...updated });
    });
  }

  remove() {
    const s = this.selected(); if (!s) return;
    if (!confirm('Remover parceiro?')) return;
    this.api.deleteAdminParceiro(s.id!).subscribe(() => {
      this.closeDetail();
      this.load();
    });
  }

  approveSelected() {
    const s = this.selected(); if (!s) return;
    this.api.approveAdminParceiro(s.id!).subscribe(u => {
      this.selected.set(u);
      this.items.set(this.items().map(x => x.id === u.id ? { ...x, ...u } : x));
    });
  }

  rejectSelected() {
    const s = this.selected(); if (!s) return;
    if (!confirm('Rejeitar este parceiro?')) return;
    this.api.rejectAdminParceiro(s.id!).subscribe(u => {
      this.selected.set(u);
      this.items.set(this.items().map(x => x.id === u.id ? { ...x, ...u } : x));
    });
  }

  toggleDestaque(p?: AdminParceiroDto | null) {
    const target = p || this.selected(); if (!target) return;
    this.api.toggleDestaqueAdminParceiro(target.id!, !target.destaque).subscribe(upd => {
      this.items.set(this.items().map(x => x.id === upd.id ? { ...x, ...upd } : x));
      if (this.selected()?.id === upd.id) this.selected.set({ ...(this.selected() as any), ...upd });
    });
  }

  // Geolocalização
  geocodeFromAddress() {
    if (!this.form) return;
    const v = flattenAddress(this.form.getRawValue());
    const line = this.composeAddressLine(v);
    if (!line) return;
    this.publicApi.geocodeAddress(line).subscribe(res => {
      if (Array.isArray(res) && res.length > 0) {
        const first = res[0];
        this.form.patchValue({ latitude: first.lat ? String(first.lat) : '', longitude: first.lon ? String(first.lon) : '' });
      }
    });
  }

  // Gerir Tipos
  openTypes() { this.showTypes.set(true); this.editingTipo.set(null); this.tipoForm = this.fb.group({ nome: ['', Validators.required], slug: [''], icone: [''], descricao: [''] }); }
  closeTypes() { this.showTypes.set(false); this.editingTipo.set(null); }

  editTipo(t: TipoProfissionalDto) {
    this.editingTipo.set(t);
    this.tipoForm = this.fb.group({ nome: [t.nome, Validators.required], slug: [t.slug || ''], icone: [t.icone || ''], descricao: [t.descricao || ''] });
  }

  saveTipo() {
    if (!this.tipoForm || this.tipoForm.invalid) { this.tipoForm?.markAllAsTouched(); return; }
    const v = this.tipoForm.getRawValue();
    const editing = this.editingTipo();
    if (editing) {
      this.api.updateTipoParceiro(editing.id, v).subscribe({
        next: () => { this.loadTipos(); this.editingTipo.set(null); },
        error: (e) => alert(e?.error?.error || 'Erro ao atualizar tipo')
      });
    } else {
      this.api.createTipoParceiro(v).subscribe({
        next: () => { this.loadTipos(); this.tipoForm.reset(); },
        error: (e) => alert(e?.error?.error || 'Erro ao criar tipo')
      });
    }
  }

  cancelEditTipo() { this.editingTipo.set(null); this.tipoForm = this.fb.group({ nome: ['', Validators.required], slug: [''], icone: [''], descricao: [''] }); }

  deleteTipo(t: TipoProfissionalDto) {
    if (!confirm(`Remover tipo "${t.nome}"?`)) return;
    this.api.deleteTipoParceiro(t.id).subscribe({ next: () => this.loadTipos(), error: (e) => alert(e?.error?.error || 'Erro ao remover tipo') });
  }

  // Helpers
  initials(u: AdminParceiroDto | null | undefined): string {
    if (!u || !u.nome) return '?';
    const parts = (u.nome || '').split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
  }

  tipoNome(id: number | null | undefined): string {
    if (id == null) return '—';
    const found = this.tiposParceiro().find(t => t.id === id);
    return found?.nome || String(id);
  }

  composeAddressLine(p: any): string {
    const parts = [p.logradouro, p.numero ? `nº ${p.numero}` : '', p.bairro, p.city && p.uf ? `${p.city}/${p.uf}` : (p.city || p.uf)];
    return parts.filter(x => x && String(x).trim()).join(', ');
  }

  digitsOnly(v: string): string { return (v || '').replace(/\D+/g, ''); }

  formatCpfCnpjDisplay(v?: string | null): string {
    const d = this.digitsOnly(v || '');
    if (d.length === 11) {
      return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    if (d.length >= 12) {
      const p = [d.slice(0,2), d.slice(2,5), d.slice(5,8), d.slice(8,12), d.slice(12,14)].filter(Boolean);
      let out = '';
      if (p[0]) out += p[0];
      if (p[1]) out += '.' + p[1];
      if (p[2]) out += '.' + p[2];
      if (p[3]) out += '/' + p[3];
      if (p[4]) out += '-' + p[4];
      return out;
    }
    return d;
  }

  blockNonDigits(ev: KeyboardEvent) {
    const allowed = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'];
    if (allowed.includes(ev.key)) return;
    if (!/^[0-9]$/.test(ev.key)) ev.preventDefault();
  }

  onCpfCnpjInput(ev: Event) {
    const el = ev.target as HTMLInputElement | null; if (!el) return;
    const masked = this.formatCpfCnpjDisplay(el.value);
    el.value = masked;
    this.form?.get('cpf_cnpj')?.setValue(masked, { emitEvent: false });
  }
}
