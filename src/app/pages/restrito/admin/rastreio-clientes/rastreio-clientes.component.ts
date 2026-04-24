import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, computed } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AdminApiService } from '../../../../services/admin-api.service';
import { ButtonDirective } from '../../../../shared/button';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-rastreio-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonDirective, RouterModule],
  templateUrl: './rastreio-clientes.component.html',
  styleUrls: ['./rastreio-clientes.component.scss'],
})
export class RastreioClientesAdminComponent implements OnInit {
  form: FormGroup;
  loading = signal(false);
  items = signal<any[]>([]);
  total = signal(0);
  page = signal(1);
  pageSize = signal(30);
  q = signal('');
  tipoFiltro = signal('');
  from = signal('');
  to = signal('');

  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  constructor(private api: AdminApiService, private fb: FormBuilder, private router: Router) {
    this.form = this.fb.group({
      q: [''],
      tipo: [''],
      from: [''],
      to: [''],
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api
      .rastreioFeed({
        q: this.q() || undefined,
        tipo: this.tipoFiltro() || undefined,
        from: this.from() || undefined,
        to: this.to() || undefined,
        page: this.page(),
        pageSize: this.pageSize(),
      })
      .subscribe({
        next: (r) => {
          this.items.set(r.items || []);
          this.total.set(r.total || 0);
        },
        error: () => {
          this.items.set([]);
          this.total.set(0);
        },
        complete: () => this.loading.set(false),
      });
  }

  applyFilters() {
    const v = this.form.getRawValue();
    this.q.set((v.q || '').trim());
    this.tipoFiltro.set((v.tipo || '').trim());
    this.from.set(v.from || '');
    this.to.set(v.to || '');
    this.page.set(1);
    this.load();
  }

  prev() {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.load();
    }
  }
  next() {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.load();
    }
  }

  goCliente(id: number | null) {
    if (id) this.router.navigate(['/restrito/admin/clientes'], { queryParams: { highlight: id } });
  }

  formatMeta(m: unknown): string {
    if (m == null) return '—';
    try {
      return JSON.stringify(m).slice(0, 240);
    } catch {
      return '—';
    }
  }
}
