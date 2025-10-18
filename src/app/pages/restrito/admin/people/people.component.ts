import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminApiService, Paged, PessoaDto, PessoaDocDto } from '../../../../services/admin-api.service';

type TipoPessoa = 'cliente' | 'vet' | 'admin';

@Component({
  selector: 'app-admin-people',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './people.component.html',
  styleUrls: ['./people.component.scss']
})
export class PeopleAdminComponent implements OnInit {
  @Input() tipo: TipoPessoa = 'cliente';

  // filtros/lista
  q = signal('');
  page = signal(1);
  pageSize = signal(10);
  loading = signal(false);
  total = signal(0);
  items = signal<PessoaDto[]>([]);

  // edição/view (accordion por linha)
  selected = signal<PessoaDto | null>(null);
  expandedId = signal<string | number | null>(null);
  form!: FormGroup;
  showDocs = signal(false);
  docs = signal<PessoaDocDto[]>([]);
  logs = signal<Array<{ id: number; action: string; reason?: string; created_at: string; admin_id?: number }>>([]);
  selectedTab = signal<'dados'|'docs'|'audit'>('dados');

  // criação
  showCreate = signal(false);
  createForm!: FormGroup;

  // filtros avançados
  status = signal<'all' | '1' | '0'>('all');
  verification = signal<'all' | 'pending' | 'approved' | 'rejected'>('all');
  city = signal('');
  uf = signal('');
  from = signal('');
  to = signal('');

  // colunas e CSV
  columns = signal<Array<{ key: keyof PessoaDto | string; label: string; on?: boolean }>>([
    { key: 'name', label: 'Nome', on: true },
    { key: 'email', label: 'Email', on: true },
    { key: 'phone', label: 'Telefone', on: false },
    { key: 'city', label: 'Cidade', on: false },
    { key: 'uf', label: 'UF', on: false },
    { key: 'active', label: 'Ativo', on: true },
    { key: 'created_at', label: 'Criado em', on: false },
  ]);

  constructor(private api: AdminApiService, private route: ActivatedRoute, private fb: FormBuilder) {}

  ngOnInit(): void {
    const dataTipo = this.route.snapshot.data?.['tipo'] as TipoPessoa | undefined;
    if (dataTipo) this.tipo = dataTipo;
    this.initCreateForm();
    this.load();
  }

  load() {
    this.loading.set(true);
    const params: any = { q: this.q(), page: this.page(), pageSize: this.pageSize(), tipo: this.tipo };
    if (this.status() !== 'all') params.status = this.status() === '1' ? 1 : 0;
    if (this.verification() !== 'all') params.verification = this.verification();
    if (this.city()) params.city = this.city();
    if (this.uf()) params.uf = this.uf();
    if (this.from()) params.from = this.from();
    if (this.to()) params.to = this.to();
  // Use unified endpoint if available (listPeople), passing all filters; fallback to legacy listUsuarios
  const api$ = this.api.listPeople ? this.api.listPeople({ ...params }) : this.api.listUsuarios(params);
    api$.subscribe({
      next: (res: Paged<any>) => {
        this.items.set(res.data || []);
        this.total.set(res.total || 0);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); }
    });
  }

  totalPages(): number { const s = this.pageSize(); const t = this.total(); return s ? Math.max(1, Math.ceil(t / s)) : 1; }
  canPrev(): boolean { return this.page() > 1; }
  canNext(): boolean { return this.page() < this.totalPages(); }
  prevPage() { if (this.canPrev()) { this.page.set(this.page() - 1); this.load(); } }
  nextPage() { if (this.canNext()) { this.page.set(this.page() + 1); this.load(); } }
  onSelectPageSize(ev: Event) { const el = ev.target as HTMLSelectElement | null; if (!el) return; const n = Number(el.value) || 10; this.pageSize.set(n); this.page.set(1); this.load(); }
  pageEnd(): number { return Math.min(this.page() * this.pageSize(), this.total()); }

  onQInput(ev: Event) { this.q.set((ev.target as HTMLInputElement).value); this.page.set(1); this.load(); }
  applyFilters() { this.page.set(1); this.load(); }

  // handlers for advanced filter inputs to keep template simple and typed
  onSelectStatus(ev: Event) {
    const el = ev.target as HTMLSelectElement | null;
    if (!el) return;
    this.status.set(el.value as any);
    this.applyFilters();
  }
  onSelectVerification(ev: Event) {
    const el = ev.target as HTMLSelectElement | null;
    if (!el) return;
    this.verification.set(el.value as any);
    this.applyFilters();
  }
  onInputCity(ev: Event) { const el = ev.target as HTMLInputElement | null; if (el) this.city.set(el.value); }
  onInputUf(ev: Event) { const el = ev.target as HTMLInputElement | null; if (el) this.uf.set((el.value || '').toUpperCase()); }
  onInputFrom(ev: Event) { const el = ev.target as HTMLInputElement | null; if (el) this.from.set(el.value); }
  onInputTo(ev: Event) { const el = ev.target as HTMLInputElement | null; if (el) this.to.set(el.value); }

  // columns toggler
  toggleColumn(index: number) {
    const next = this.columns().map((c, i) => i === index ? { ...c, on: !c.on } : c);
    this.columns.set(next);
  }

  // UI helpers
  idOf(u: any): string | number | null { return (u?.id ?? u?.uid) ?? null; }
  displayName(u: Partial<PessoaDto> & Record<string, any>) {
    return u.name || (u as any).nome || (u as any).full_name || u.email || (u as any).username || '—';
  }
  displaySecondary(u: Partial<PessoaDto> & Record<string, any>) {
    return u.email || (u as any).username || '';
  }
  initials(u: Partial<PessoaDto> & Record<string, any>) {
    const n = (u.name || (u as any).nome || u.email || '').toString();
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0,2).toUpperCase();
    return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
  }
  tipoLabel(u?: Partial<PessoaDto>) { return (u?.tipo || this.tipo) as string; }
  isActive(u: any) { return Number(u?.active ?? u?.ativo ?? 0) === 1; }
  vetApproved(u: any) { return Number(u?.approved ?? (u?.verification_status === 'approved' ? 1 : 0)) === 1; }
  statusChips(u: any): Array<{ label: string; cls: string }> {
    const chips: Array<{label:string;cls:string}> = [];
    const tipo = (u?.tipo || this.tipo);
    if (tipo === 'vet') {
      if (u?.verification_status === 'rejected') chips.push({ label: 'Reprovado', cls: 'danger' });
      else if (this.vetApproved(u)) chips.push({ label: 'Aprovado', cls: 'ok' });
      else chips.push({ label: 'Pendente', cls: 'warn' });
    }
    chips.push({ label: this.isActive(u) ? 'Ativo' : 'Inativo', cls: this.isActive(u) ? 'ok' : '' });
    if (tipo === 'admin' && (u as any).is_super) chips.push({ label: 'Super', cls: 'info' });
    return chips;
  }

  view(u: PessoaDto) {
    this.selected.set(u);
    this.expandedId.set(this.idOf(u));
    this.showDocs.set(false);
    this.selectedTab.set('dados');
    this.form = this.fb.group({
      name: [u.name || (u as any).nome || '', [Validators.required, Validators.minLength(2)]],
      email: [u.email || '', [Validators.required, Validators.email]],
      phone: [u.phone || (u as any).telefone || ''],
      city: [u.city || ''],
      uf: [u.uf || ''],
      cpf: [u.cpf || ''],
      crmv: [u.crmv || '']
    });
    const id = (u.id ?? (u as any).uid) as any;
    if (id) {
      this.api.listUsuarioDocs(id).subscribe((d) => this.docs.set(d || []));
      // auditoria (quando disponível para vet) + approvals history
      if (this.tipo === 'vet') {
        if (this.api.vetAuditLogs) this.api.vetAuditLogs(id).subscribe(logs => this.logs.set(logs || []));
        if ((this.api as any).listVetApprovals) (this.api as any).listVetApprovals(id).subscribe();
      } else { this.logs.set([]); }
    } else {
      this.docs.set([]);
      this.logs.set([]);
    }
  }
  toggleDocs() { this.showDocs.set(!this.showDocs()); }
  closeDetail() { this.selected.set(null); this.expandedId.set(null); }
  isExpanded(u: any): boolean { const id = this.idOf(u); return id != null && id === this.expandedId(); }
  toggleExpand(u: any) { if (this.isExpanded(u)) { this.closeDetail(); } else { this.view(u as any); } }
  selectTab(tab: 'dados'|'docs'|'audit') { this.selectedTab.set(tab); }

  ativar(u: any) {
    const id = u.id || u.uid; const tipo = this.tipo; const body: any = { tipo, ativo: 1 };
    if (this.api.updatePerson) this.api.updatePerson(id, tipo, body).subscribe(() => this.load()); else this.api.updateUsuario(id, { active: 1 }).subscribe(() => this.load());
  }
  desativar(u: any) {
    const id = u.id || u.uid; const tipo = this.tipo; const body: any = { tipo, ativo: 0 };
    if (this.api.updatePerson) this.api.updatePerson(id, tipo, body).subscribe(() => this.load()); else this.api.updateUsuario(id, { active: 0 }).subscribe(() => this.load());
  }

  salvarEdicao() {
    const u = this.selected();
    if (!u || !this.form || this.form.invalid) { this.form?.markAllAsTouched(); return; }
    const id = (u.id ?? (u as any).uid) as any;
    const tipo = this.tipo;
    const payload: any = { ...this.form.value };
    // Map aliases to backend field names
    if ('name' in payload) { payload.nome = payload.name; delete payload.name; }
    if ('phone' in payload) { payload.telefone = payload.phone; delete payload.phone; }
    const update$ = this.api.updatePerson ? this.api.updatePerson(id, tipo, payload) : this.api.updateUsuario(id, this.form.value);
    update$.subscribe(() => {
      const arr = this.items().map(x => (x.id === id || (x as any).uid === id) ? { ...x, ...this.form.value } : x);
      this.items.set(arr);
      this.selected.set({ ...(this.selected() as any), ...this.form.value });
    });
  }
  cancelarEdicao() { this.selected() && this.view(this.selected()!); }

  onSelectDoc(ev: Event, tipo: PessoaDocDto['tipo']) {
    const u = this.selected();
    const input = ev.target as HTMLInputElement;
    if (!u || !input.files || input.files.length === 0) return;
    const file = input.files[0];
    const id = (u.id ?? (u as any).uid) as any;
    this.api.uploadUsuarioDoc(id, file, tipo).subscribe(doc => {
      this.docs.set([doc, ...this.docs()]);
      input.value = '';
    });
  }
  removeDoc(d: PessoaDocDto) {
    const u = this.selected();
    if (!u) return;
    const id = (u.id ?? (u as any).uid) as any;
    this.api.deleteUsuarioDoc(id, d.id).subscribe(() => {
      this.docs.set(this.docs().filter(x => x.id !== d.id));
    });
  }

  aprovarVet() {
    const u = this.selected();
    if (!u) return;
    const id = (u.id ?? (u as any).uid) as any;
    // use dedicated endpoint for explicit audit trail
    if (this.api.approveVet) {
      this.api.approveVet(id, {}).subscribe((updated) => { this.selected.set({ ...u, ...updated, approved: 1, verification_status: 'approved' }); this.load(); });
    } else if (this.api.updatePerson) {
      this.api.updatePerson(id, 'vet', { approved: 1 }).subscribe(() => { this.selected.set({ ...u, approved: 1, verification_status: 'approved' }); this.load(); });
    }
  }
  reprovarVet() {
    const u = this.selected();
    if (!u) return;
    const motivo = prompt('Motivo da reprovação?');
    if (!motivo) return;
    const id = (u.id ?? (u as any).uid) as any;
    if (this.api.rejectVet) {
      this.api.rejectVet(id, { reason: motivo }).subscribe((updated) => { this.selected.set({ ...u, ...updated, approved: 0, verification_status: 'rejected' }); this.load(); });
    } else if (this.api.updatePerson) {
      this.api.updatePerson(id, 'vet', { approved: 0 }).subscribe(() => { this.selected.set({ ...u, approved: 0, verification_status: 'rejected' }); this.load(); });
    }
  }

  // Quick actions in list (without opening detail)
  aprovarVetQuick(u: any) {
    const id = u.id || u.uid; if (!id) return;
    if (this.api.approveVet) this.api.approveVet(id, {}).subscribe(() => this.load());
    else if (this.api.updatePerson) this.api.updatePerson(id, 'vet', { approved: 1 }).subscribe(() => this.load());
  }
  reprovarVetQuick(u: any) {
    const id = u.id || u.uid; if (!id) return;
    const motivo = prompt('Motivo da reprovação?');
    if (!motivo) return;
    if (this.api.rejectVet) this.api.rejectVet(id, { reason: motivo }).subscribe(() => this.load());
    else if (this.api.updatePerson) this.api.updatePerson(id, 'vet', { approved: 0 }).subscribe(() => this.load());
  }

  exportCSV() {
    const cols = this.columns().filter(c => c.on);
    const header = cols.map(c => '"'+c.label+'"').join(',');
    const rows = this.items().map((r) => cols.map(c => {
      const v = (r as any)[c.key as any];
      return '"'+(v != null ? String(v).replace(/"/g, '""') : '')+'"';
    }).join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `export-${this.tipo}-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // criação
  initCreateForm() {
    this.createForm = this.fb.group({
      tipo: [this.tipo, Validators.required],
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      cpf: [''],
      crmv: [''],
      phone: [''],
      senha: [''],
      ativo: [1],
      approved: [this.tipo === 'vet' ? 0 : 1]
    });
  }
  openCreate() { this.showCreate.set(true); this.initCreateForm(); }
  cancelCreate() { this.showCreate.set(false); }
  submitCreate() {
    if (this.createForm.invalid) { this.createForm.markAllAsTouched(); return; }
    const v = this.createForm.value as any;
    const tipo = v.tipo as TipoPessoa;
    const body: any = { tipo, nome: v.name, email: v.email };
    if (v.cpf) body.cpf = v.cpf;
    if (v.crmv) body.crmv = v.crmv;
    if (v.phone) body.telefone = v.phone;
    if (v.senha) body.senha = v.senha;
    if (tipo === 'vet') body.approved = Number(v.approved) || 0; else body.ativo = Number(v.ativo) || 1;
    this.api.createPerson(body).subscribe(created => {
      this.showCreate.set(false);
      this.page.set(1);
      this.load();
      setTimeout(() => this.view(created as any), 0);
    });
  }
  removeSelected() {
    const s = this.selected();
    if (!s) return;
    if (!confirm('Remover este registro?')) return;
    this.api.deletePerson(s.id as any, this.tipo).subscribe(() => { this.selected.set(null); this.load(); });
  }
}
