import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminPaginationComponent } from '../shared/admin-pagination/admin-pagination.component';
import { AdminDrawerComponent } from '../shared/admin-drawer/admin-drawer.component';
import { AdminApiService, Paged, PessoaDto, PessoaDocDto } from '../../../../services/admin-api.service';
import { ApiService } from '../../../../services/api.service';
import { ButtonDirective } from '../../../../shared/button';
import { AdminAddressComponent, buildAddressGroup, flattenAddress } from '../../../../shared/admin-address';

type TipoPessoa = 'cliente' | 'vet' | 'admin';

@Component({
  selector: 'app-admin-people',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, AdminPaginationComponent, AdminDrawerComponent, ButtonDirective, AdminAddressComponent],
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
  selectedTab = signal<'dados'|'docs'|'audit'|'atividade'>('dados');
  rastreioItems = signal<
    Array<{
      id: number;
      tipo: string;
      path: string | null;
      meta: unknown;
      created_at: string;
    }>
  >([]);
  rastreioCursor = signal<string | number | null>(null);
  rastreioLoading = signal(false);

  // criação
  showCreate = signal(false);
  createForm!: FormGroup;

  // UI state
  showColsMenu = signal(false);

  // admin-specific options
  areasList = [
    { key: 'pedidos', label: 'Pedidos' },
    { key: 'produtos', label: 'Produtos' },
    { key: 'promocoes', label: 'Promoções' },
    { key: 'banners', label: 'Banners' },
    { key: 'ativos', label: 'Ativos' }
  ];

  roleOptions = [
    { value: 'super', label: 'Super' },
    { value: 'admin', label: 'Admin' },
    { value: 'funcionario', label: 'Funcionário' }
  ];

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

  constructor(private api: AdminApiService, private publicApi: ApiService, private route: ActivatedRoute, private fb: FormBuilder) {}

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
  toggleColsMenu() { this.showColsMenu.set(!this.showColsMenu()); }

  // file type icons for docs uploader
  docIconFor(tipo: string): string {
    switch (tipo) {
      case 'rg': return 'fa fa-id-card';
      case 'cpf': return 'fa fa-id-badge';
      case 'crmv': return 'fa fa-stethoscope';
      case 'comprovante': return 'fa fa-file-text-o';
      default: return 'fa fa-file-o';
    }
  }
  docsTipos: Array<{ key: PessoaDocDto['tipo']; label: string }> = [
    { key: 'rg', label: 'RG' },
    { key: 'cpf', label: 'CPF' },
    { key: 'crmv', label: 'CRMV' },
    { key: 'comprovante', label: 'Comprovante' },
    { key: 'outro', label: 'Outro' }
  ];

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
    this.rastreioItems.set([]);
    this.rastreioCursor.set(null);
    const anyU = u as any;
    const endereco = anyU.endereco || {};
    this.form = this.fb.group({
      name: [u.name || anyU.nome || '', [Validators.required, Validators.minLength(2)]],
      email: [u.email || '', [Validators.required, Validators.email]],
      phone: [u.phone || anyU.telefone || ''],
      cpf: [u.cpf || ''],
      crmv: [u.crmv || ''],
      role: [anyU.role || ''],
      areas: [anyU.areas || []],
      address: buildAddressGroup(this.fb, {
        cep: anyU.cep ?? endereco.cep ?? '',
        logradouro: anyU.logradouro ?? endereco.logradouro ?? '',
        numero: anyU.numero ?? endereco.numero ?? '',
        complemento: anyU.complemento ?? endereco.complemento ?? '',
        bairro: anyU.bairro ?? endereco.bairro ?? '',
        city: u.city ?? endereco.cidade ?? '',
        uf: u.uf ?? endereco.estado ?? ''
      })
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
  selectTab(tab: 'dados' | 'docs' | 'audit' | 'atividade') {
    this.selectedTab.set(tab);
    if (tab === 'atividade' && this.tipo === 'cliente') {
      this.rastreioItems.set([]);
      this.rastreioCursor.set(null);
      this.loadRastreio();
    }
  }

  loadRastreio(append = false) {
    if (this.tipo !== 'cliente') return;
    const u = this.selected();
    if (!u) return;
    const id = (u as any).id ?? (u as any).uid;
    if (id == null) return;
    this.rastreioLoading.set(true);
    const cursor = append ? this.rastreioCursor() : null;
    this.api.rastreioTimeline(id, { cursor: cursor != null ? String(cursor) : undefined, limit: 50 }).subscribe({
      next: (r) => {
        const items = r.items || [];
        if (append) this.rastreioItems.update((arr) => [...arr, ...items]);
        else this.rastreioItems.set(items);
        this.rastreioCursor.set(r.nextCursor);
      },
      error: () => {
        if (!append) this.rastreioItems.set([]);
      },
      complete: () => this.rastreioLoading.set(false)
    });
  }

  loadMoreRastreio() {
    if (this.rastreioCursor() != null) this.loadRastreio(true);
  }

  ativar(u: any) {
    const id = u.id || u.uid; const tipo = this.tipo; const body: any = { tipo, ativo: 1 };
    const onOk = (updated?: PessoaDto) => {
      this.load();
      if (updated && this.expandedId() != null && String((updated as any).id) === String(id)) {
        const prev = this.selected() as any;
        this.view({ ...(prev || {}), ...updated } as PessoaDto);
      }
    };
    if (this.api.updatePerson) {
      this.api.updatePerson(id, tipo, body).subscribe((r) => onOk(r));
    } else {
      this.api.updateUsuario(id, { active: 1 } as any).subscribe(() => onOk());
    }
  }
  desativar(u: any) {
    const motivo = window.prompt('Informe o motivo da desativação (obrigatório, mín. 3 caracteres):', '');
    if (motivo === null) return;
    const m = (motivo || '').trim();
    if (m.length < 3) {
      window.alert('O motivo é obrigatório (mínimo 3 caracteres).');
      return;
    }
    const id = u.id || u.uid; const tipo = this.tipo; const body: any = { tipo, ativo: 0, inativacao_motivo: m };
    const onOk = (updated?: PessoaDto) => {
      this.load();
      if (updated && this.expandedId() != null && String((updated as any).id) === String(id)) {
        const prev = this.selected() as any;
        this.view({ ...(prev || {}), ...updated } as PessoaDto);
      }
    };
    if (this.api.updatePerson) {
      this.api.updatePerson(id, tipo, body).subscribe((r) => onOk(r));
    } else {
      this.api.updateUsuario(id, { active: 0, inativacao_motivo: m } as any).subscribe(() => onOk());
    }
  }

  salvarEdicao() {
    const u = this.selected();
    if (!u || !this.form || this.form.invalid) { this.form?.markAllAsTouched(); return; }
    const id = (u.id ?? (u as any).uid) as any;
    const tipo = this.tipo;
    const raw: any = this.form.getRawValue();
    const flat: any = flattenAddress(raw);
    // Map aliases to backend field names
    if ('name' in flat) { flat.nome = flat.name; delete flat.name; }
    if ('phone' in flat) { flat.telefone = flat.phone; delete flat.phone; }
    const update$ = this.api.updatePerson ? this.api.updatePerson(id, tipo, flat) : this.api.updateUsuario(id, flat as any);
    update$.subscribe(() => {
      const arr = this.items().map(x => (x.id === id || (x as any).uid === id) ? { ...x, ...flat } : x);
      this.items.set(arr);
      this.selected.set({ ...(this.selected() as any), ...flat });
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
      inativacao_motivo: [''],
      approved: [this.tipo === 'vet' ? 0 : 1],
      // admin-specific
      role: [this.tipo === 'admin' ? 'funcionario' : ''],
      areas: [[]]
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
    // include admin-specific fields when present
    if (v.role) body.role = v.role;
    if (Array.isArray(v.areas) && v.areas.length) body.areas = v.areas;
    if (tipo === 'vet') body.approved = Number(v.approved) || 0; else body.ativo = Number(v.ativo) || 1;
    const a0 = tipo !== 'vet' && Number(v.ativo) === 0;
    if (a0) {
      const mot = (v.inativacao_motivo || '').toString().trim();
      if (mot.length < 3) {
        window.alert('Com conta inativa, informe o motivo da inativação (mínimo 3 caracteres).');
        return;
      }
      body.inativacao_motivo = mot;
    }
    this.api.createPerson(body).subscribe(created => {
      this.showCreate.set(false);
      this.page.set(1);
      this.load();
      setTimeout(() => this.view(created as any), 0);
    });
  }
  toggleCreateArea(ev: Event, key: string) {
    const input = ev.target as HTMLInputElement;
    const ctrl = this.createForm.get('areas');
    const arr = Array.isArray(ctrl?.value) ? [...(ctrl?.value as any[])] : [];
    if (input.checked) { if (!arr.includes(key)) arr.push(key); }
    else { const i = arr.indexOf(key); if (i >= 0) arr.splice(i, 1); }
    ctrl?.setValue(arr);
  }
  toggleEditArea(ev: Event, key: string) {
    const input = ev.target as HTMLInputElement;
    const ctrl = this.form.get('areas');
    const arr = Array.isArray(ctrl?.value) ? [...(ctrl?.value as any[])] : [];
    if (input.checked) { if (!arr.includes(key)) arr.push(key); }
    else { const i = arr.indexOf(key); if (i >= 0) arr.splice(i, 1); }
    ctrl?.setValue(arr);
  }
  removeSelected() {
    const s = this.selected();
    if (!s) return;
    if (!confirm('Remover este registro?')) return;
    this.api.deletePerson(s.id as any, this.tipo).subscribe(() => { this.selected.set(null); this.load(); });
  }
}
