import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminPaginationComponent } from '../shared/admin-pagination/admin-pagination.component';
import { ButtonDirective, ButtonComponent } from '../../../../shared/button';
import { AdminApiService, CupomDto, CupomPayload, Paged } from '../../../../services/admin-api.service';
import { FormSchema } from '../../../../shared/admin-crud/form-schema';
import { AdminCrudComponent } from '../../../../shared/admin-crud/admin-crud.component';
import { AdminListingComponent } from '../../../../shared/admin-listing/admin-listing.component';
import { SideDrawerComponent } from '../../../../shared/side-drawer/side-drawer.component';

@Component({
  selector: 'app-admin-cupons',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, AdminPaginationComponent, ButtonDirective, ButtonComponent, AdminListingComponent, SideDrawerComponent, AdminCrudComponent],
  templateUrl: './cupons.component.html',
  styleUrls: ['./cupons.component.scss']
})
export class CuponsAdminComponent implements OnInit {
  q = signal('');
  active = signal<'all'|'1'|'0'>('all');
  page = signal(1);
  pageSize = signal(10);
  total = signal(0);
  items = signal<CupomDto[]>([]);
  loading = signal(false);

  selected = signal<CupomDto|null>(null);
  form!: FormGroup;

  showCreate = signal(false);
  createForm!: FormGroup;

  cuponsColumns = [
    { key: 'codigo', label: 'Código' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'tipo', label: 'Tipo', width: '120px' },
    { key: 'valorLabel', label: 'Valor', width: '120px' },
    { key: 'validade', label: 'Validade', width: '140px' },
    { key: 'ativoLabel', label: 'Ativo', width: '90px' },
    { key: 'usado', label: 'Usado', width: '80px' }
  ];

  cuponsFormSchema: FormSchema = {
    fields: [
      { key: 'codigo', label: 'Código', type: 'text', required: true },
      { key: 'descricao', label: 'Descrição', type: 'text' },
      { key: 'tipo', label: 'Tipo', type: 'select', options: [{ value: 'percentual', label: 'Percentual' }, { value: 'valor', label: 'Valor' }], default: 'percentual' },
      { key: 'valor', label: 'Valor', type: 'number' },
      { key: 'valor_minimo', label: 'Valor mínimo', type: 'number' },
      { key: 'desconto_maximo', label: 'Desconto máximo', type: 'number' },
      { key: 'validade', label: 'Validade', type: 'date' },
      { key: 'primeira_compra', label: 'Primeira compra', type: 'select', options: [{ value: 0, label: 'Não' }, { value: 1, label: 'Sim' }], default: 0 },
      { key: 'frete_gratis', label: 'Frete grátis', type: 'select', options: [{ value: 0, label: 'Não' }, { value: 1, label: 'Sim' }], default: 0 },
      { key: 'ativo', label: 'Ativo', type: 'select', options: [{ value: 1, label: 'Ativo' }, { value: 0, label: 'Inativo' }], default: 1 },
      { key: 'usado', label: 'Usado', type: 'number' },
      { key: 'restricoes_json', label: 'Restrições (JSON)', type: 'textarea' },
      { key: 'max_uso', label: 'Max uso', type: 'number' },
      { key: 'limite_por_cliente', label: 'Limite por cliente', type: 'number' }
    ],
    submitLabel: 'Salvar',
    title: 'Cupom'
  };

  constructor(private api: AdminApiService, private fb: FormBuilder) {}

  ngOnInit(): void {
    this.initCreateForm();
    this.load();
  }

  initCreateForm() {
    this.createForm = this.fb.group({
      codigo: ['', [Validators.required, Validators.minLength(2)]],
      descricao: [''],
      tipo: ['percentual', Validators.required],
      valor: [0, [Validators.required]],
      valor_minimo: [null],
      desconto_maximo: [null],
      primeira_compra: [0],
      frete_gratis: [0],
      ativo: [1],
      validade: [''],
      max_uso: [null],
      limite_por_cliente: [1],
      restricoes_json: [''],
      usado: [0]
    });
  }

  load() {
    this.loading.set(true);
    const params: any = { q: this.q(), page: this.page(), pageSize: this.pageSize() };
    if (this.active() !== 'all') params.active = this.active() === '1' ? 1 : 0;
    this.api.listCupons(params).subscribe({
      next: (res: Paged<CupomDto>) => {
        const list = (res.data || []).map((it: any) => ({
          ...it,
          valorLabel: it.tipo === 'percentual' ? `${it.valor}%` : (it.frete_gratis ? 'Frete grátis' : `R$ ${it.valor}`),
          ativoLabel: (it.ativo ?? 1) === 1 ? 'Ativo' : 'Inativo'
        }));
        this.items.set(list as any);
        this.total.set(res.total || 0);
        this.loading.set(false);
      },
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

  view(item: CupomDto) {
    this.selected.set(item);
    this.form = this.fb.group({
      codigo: [item.codigo || '', [Validators.required]],
      descricao: [item.descricao || ''],
      tipo: [item.tipo || 'percentual', Validators.required],
      valor: [item.valor ?? 0, Validators.required],
      valor_minimo: [item.valor_minimo ?? null],
      desconto_maximo: [item.desconto_maximo ?? null],
      primeira_compra: [item.primeira_compra ?? 0],
      frete_gratis: [item.frete_gratis ?? 0],
      ativo: [item.ativo ?? 1],
      validade: [item.validade || ''],
      max_uso: [item.max_uso ?? null],
      limite_por_cliente: [item.limite_por_cliente ?? 1],
      restricoes_json: [item.restricoes_json || ''],
      usado: [item.usado ?? 0]
    });
  }

  closeDetail() { this.selected.set(null); }

  save() {
    const s = this.selected(); if (!s || !this.form || this.form.invalid) { this.form?.markAllAsTouched(); return; }
    const payload: any = { ...this.form.value } as CupomPayload;
    // Ensure numeric fields
    payload.valor = Number(payload.valor || 0);
    if (payload.valor_minimo != null) payload.valor_minimo = Number(payload.valor_minimo);
    if (payload.desconto_maximo != null) payload.desconto_maximo = Number(payload.desconto_maximo);
    payload.primeira_compra = Number(payload.primeira_compra) ? 1 : 0;
    payload.frete_gratis = Number(payload.frete_gratis) ? 1 : 0;
    payload.ativo = Number(payload.ativo) ? 1 : 0;
    payload.usado = Number(payload.usado || 0);
    // Validate JSON
    if (payload.restricoes_json) {
      try { JSON.parse(payload.restricoes_json); } catch (e) { alert('restricoes_json inválido'); return; }
    }
    this.api.updateCupom(s.id!, payload).subscribe(updated => {
      this.items.set(this.items().map(x => x.id === updated.id ? { ...x, ...updated } : x));
      this.selected.set(updated);
    });
  }

  remove() {
    const s = this.selected(); if (!s) return; if (!confirm('Remover cupom?')) return;
    this.api.deleteCupom(s.id!).subscribe(() => { this.selected.set(null); this.load(); });
  }

  removeItem(item: CupomDto) {
    if (!item) return;
    if (!confirm('Remover cupom?')) return;
    this.api.deleteCupom(item.id!).subscribe(() => this.load());
  }

  openCreate() { this.showCreate.set(true); this.initCreateForm(); }
  cancelCreate() { this.showCreate.set(false); }

  create() {
    if (this.createForm.invalid) { this.createForm.markAllAsTouched(); return; }
    const payload: any = { ...this.createForm.value } as CupomPayload;
    payload.valor = Number(payload.valor || 0);
    payload.primeira_compra = Number(payload.primeira_compra) ? 1 : 0;
    payload.frete_gratis = Number(payload.frete_gratis) ? 1 : 0;
    payload.ativo = Number(payload.ativo) ? 1 : 0;
    if (payload.restricoes_json) {
      try { JSON.parse(payload.restricoes_json); } catch (e) { alert('restricoes_json inválido'); return; }
    }
    this.api.createCupom(payload).subscribe(created => {
      this.showCreate.set(false);
      this.page.set(1);
      this.load();
      setTimeout(() => this.view(created), 0);
    });
  }

  validar(codigo: string) {
    if (!codigo) return;
    this.api.validarCupom({ codigo }).subscribe(res => {
      alert(res?.message || (res?.ok ? 'Validação OK' : 'Cupom inválido'));
    }, err => {
      alert('Erro ao validar cupom');
    });
  }

  // Schema-driven submit handler (used by app-admin-crud)
  onSchemaSubmit(ev: { id?: any; values: any }) {
    const id = ev.id;
    const body: any = { ...ev.values };
    body.valor = Number(body.valor || 0);
    if (body.valor_minimo != null) body.valor_minimo = Number(body.valor_minimo);
    if (body.desconto_maximo != null) body.desconto_maximo = Number(body.desconto_maximo);
    body.primeira_compra = Number(body.primeira_compra) ? 1 : 0;
    body.frete_gratis = Number(body.frete_gratis) ? 1 : 0;
    body.ativo = Number(body.ativo) ? 1 : 0;
    body.usado = Number(body.usado || 0);
    if (body.restricoes_json) {
      try { JSON.parse(body.restricoes_json); } catch (e) { alert('restricoes_json inválido'); return; }
    }

    if (id) {
      this.api.updateCupom(id, body).subscribe((updated: any) => {
        this.items.set(this.items().map(x => x.id === updated.id ? { ...x, ...updated } : x));
        this.selected.set(updated);
        this.load();
      });
    } else {
      this.api.createCupom(body).subscribe((created: any) => {
        this.showCreate.set(false);
        this.page.set(1);
        this.load();
        setTimeout(() => this.view(created), 0);
      });
    }
  }

  removeFromTable(item: any) {
    if (!item?.id) return;
    if (!confirm('Remover cupom?')) return;
    this.api.deleteCupom(item.id).subscribe(() => this.load());
  }

  openCreateForSchema() {
    this.selected.set(null);
    this.showCreate.set(true);
  }

  onDrawerOpenChange(open: boolean) {
    if (!open) {
      try { this.showCreate.set(false); } catch (e) {}
      try { this.selected.set(null); } catch (e) {}
    }
  }
}
