import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminPaginationComponent } from '../shared/admin-pagination/admin-pagination.component';
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
  submitting = signal(false);

  selected = signal<any|null>(null);
  showCreate = signal(false);
  drawerOpen = computed(() => this.selected() !== null || this.showCreate());
  @ViewChild('detailRef') detailRef!: ElementRef<HTMLElement>;
  @ViewChild('listRef') listRef!: ElementRef<HTMLElement>;

  ativoForm!: FormGroup;

  ativosColumns = [
    { key: 'id', label: 'ID', width: '60px' },
    { key: 'nome', label: 'Nome' },
    { key: 'active', label: 'Status', width: '120px', formatter: (it: any) => (it.active ? 'Ativo' : 'Inativo') }
  ];

  constructor(private api: AdminApiService, private fb: FormBuilder) {}

  ngOnInit(): void {
    this.resetAtivoForm();
    this.load();
  }

  resetAtivoForm(item?: any | null) {
    const it: any = item || {};
    this.ativoForm = this.fb.group({
      nome: [it.nome || '', [Validators.required, Validators.minLength(2)]],
      descricao: [it.descricao || ''],
      doseCaes: [it.doseCaes || ''],
      doseGatos: [it.doseGatos || ''],
      active: [it.active ?? 1]
    });
  }

  load() {
    this.loading.set(true);
    const params: any = { page: this.page(), pageSize: this.pageSize() };
    if (this.q()) params.q = this.q();
    if (this.active() === '1') params.active = 1;
    if (this.active() === '0') params.active = 0;
    this.api.listAtivos(params).subscribe({
      next: (res: Paged<any>) => { this.items.set(res.data || []); this.total.set(res.total || 0); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  onQuickSearch(value: string) {
    this.q.set((value || '').trim());
    this.page.set(1);
    this.load();
  }

  setActive(v: 'all'|'1'|'0') {
    if (this.active() === v) return;
    this.active.set(v);
    this.page.set(1);
    this.load();
  }

  hasFilters() { return !!this.q() || this.active() !== 'all'; }
  clearFilters() {
    this.q.set('');
    this.active.set('all');
    this.page.set(1);
    this.load();
  }

  totalPages() { const s=this.pageSize(); const t=this.total(); return s? Math.max(1, Math.ceil(t/s)) : 1; }
  canPrev() { return this.page()>1; }
  canNext() { return this.page()<this.totalPages(); }

  view(item: any) {
    this.selected.set(item);
    this.resetAtivoForm(item);
    setTimeout(() => {
      try { this.detailRef?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }); } catch(e){}
    }, 50);
  }

  closeDrawer() {
    this.selected.set(null);
    this.showCreate.set(false);
  }
  onDrawerOpenChange(open: boolean) { if (!open) this.closeDrawer(); }

  openCreate() {
    this.selected.set(null);
    this.resetAtivoForm();
    this.showCreate.set(true);
  }

  submitAtivo() {
    if (this.ativoForm.invalid) { this.ativoForm.markAllAsTouched(); return; }
    const body: any = { ...this.ativoForm.value };
    body.active = Number(body.active) ? 1 : 0;

    const current = this.selected();
    this.submitting.set(true);
    const req$ = current?.id
      ? this.api.updateAtivo(current.id, body)
      : this.api.createAtivo(body);

    req$.subscribe({
      next: (saved: any) => {
        this.submitting.set(false);
        this.closeDrawer();
        this.page.set(1);
        this.load();
      },
      error: () => this.submitting.set(false)
    });
  }

  remove(item: any | null) {
    const s = item || this.selected();
    if (!s?.id) return;
    if (!confirm('Remover ativo?')) return;
    this.api.deleteAtivo(s.id).subscribe(() => { this.closeDrawer(); this.load(); });
  }
}
