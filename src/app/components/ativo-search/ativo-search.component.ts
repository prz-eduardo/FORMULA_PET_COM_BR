import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Ativo } from '../../services/api.service';
import { AdminApiService } from '../../services/admin-api.service';
import { debounceTime, distinctUntilChanged, filter, switchMap, of, catchError, Subject } from 'rxjs';

export type AtivoOption = { id: number | string; ativo_nome: string };

@Component({
  selector: 'app-ativo-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ativo-search.component.html',
  styleUrls: ['./ativo-search.component.scss']
})
export class AtivoSearchComponent implements OnInit {
  private publicApi = inject(ApiService);
  private adminApi = inject(AdminApiService);

  @Input() label: string = 'Associar Ativo';
  @Input() placeholder: string = 'Digite para buscar o ativo';
  @Input() source: 'public' | 'admin' = 'public';
  @Input() minLength = 2;
  @Input() preload = false; // quando true, carrega uma vez e filtra localmente
  @Output() selected = new EventEmitter<AtivoOption | null>();

  query = signal<string>('');
  ativosAll: Ativo[] = [];
  sugestoes: AtivoOption[] = [];
  selecionado: AtivoOption | null = null;
  activeIndex = signal<number>(-1);
  private search$ = new Subject<string>();

  ngOnInit(): void {
    // Preload opcional para evitar many requests (estilo produto/receita)
    if (this.preload) {
      if (this.source === 'admin') {
        this.adminApi.listAtivos({ page: 1, pageSize: 1000 }).subscribe({
          next: (res: any) => {
            this.ativosAll = Array.isArray(res?.data) ? res.data : [];
            const term = (this.query() || '').trim().toLowerCase();
            if (term) this.updateSuggestionsFrom(term, this.ativosAll as any);
          },
          error: () => { this.ativosAll = []; }
        });
      } else {
        this.publicApi.getAtivos().subscribe({
          next: (list) => {
            this.ativosAll = Array.isArray(list) ? list : [];
            const term = (this.query() || '').trim().toLowerCase();
            if (term) this.updateSuggestionsFrom(term, this.ativosAll);
          },
          error: () => { this.ativosAll = []; }
        });
      }
    } else {
      // Comportamento antigo: buscar por termo
      this.publicApi.getAtivos().subscribe({
        next: (list) => {
          this.ativosAll = Array.isArray(list) ? list : [];
          const term = (this.query() || '').trim().toLowerCase();
          if (term) this.updateSuggestionsFrom(term, this.ativosAll);
        },
        error: () => { this.ativosAll = []; }
      });
    }

    // Pipeline de busca com debounce e fallback
    this.search$
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        switchMap((term) => {
          if (this.preload) {
            // Apenas filtra localmente
            return of(this.ativosAll || []);
          }
          if (this.source === 'admin') {
            return this.adminApi.listAtivos({ q: term, page: 1, pageSize: 20 }).pipe(catchError(() => of({ data: [] })) as any);
          }
          return this.publicApi.searchAtivos(term).pipe(catchError(() => of(this.ativosAll || [])));
        })
      )
      .subscribe((res: any) => {
        const term = (this.query() || '').trim().toLowerCase();
        const base = this.preload
          ? (this.ativosAll || [])
          : (this.source === 'admin' ? (Array.isArray(res?.data) ? res.data : []) : (Array.isArray(res) ? res : (this.ativosAll || [])));
        this.updateSuggestionsFrom(term, base as any);
      });
  }

  onInput(val: string) {
    this.query.set(val);
    const term = (val || '').trim().toLowerCase();
    if (!term || term.length < this.minLength) { this.sugestoes = []; this.activeIndex.set(-1); return; }
    this.search$.next(term);
  }

  onKeyDown(ev: KeyboardEvent) {
    if (!this.sugestoes.length) return;
    const idx = this.activeIndex();
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      this.activeIndex.set((idx + 1) % this.sugestoes.length);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.activeIndex.set((idx - 1 + this.sugestoes.length) % this.sugestoes.length);
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const sel = this.sugestoes[idx >= 0 ? idx : 0];
      if (sel) this.pick(sel);
    } else if (ev.key === 'Escape') {
      this.sugestoes = [];
    }
  }

  private updateSuggestionsFrom(termLower: string, base: any[]) {
    const filtered = (base || []).filter(a => ((a.nome || a.name || a.ativo_nome || '') as string).toLowerCase().includes(termLower) || (a.descricao || '').toLowerCase().includes(termLower));
    this.sugestoes = filtered.slice(0, 20).map(a => ({ id: a.id, ativo_nome: (a.nome || a.name || a.ativo_nome) }));
    this.activeIndex.set(this.sugestoes.length ? 0 : -1);
  }

  pick(op: AtivoOption) {
    this.selecionado = op;
    this.query.set(op.ativo_nome);
    this.sugestoes = [];
    this.selected.emit(op);
  }

  clear() {
    this.selecionado = null;
    this.query.set('');
    this.sugestoes = [];
    this.selected.emit(null);
  }
}
