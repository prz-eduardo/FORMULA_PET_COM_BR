import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray } from '@angular/forms';
import { AdminApiService, MarketplaceCategoria, MarketplaceTag, MarketplaceCustomizacoesResponse } from '../../../../services/admin-api.service';

@Component({
  selector: 'app-admin-marketplace-customizacoes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './marketplace-customizacoes.component.html',
  styleUrls: ['./marketplace-customizacoes.component.scss']
})
export class MarketplaceCustomizacoesAdminComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(AdminApiService);

  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  categoriasFA = this.fb.array([]);
  tagsFA = this.fb.array([]);

  get categorias() { return this.categoriasFA as unknown as FormArray; }
  get tags() { return this.tagsFA as unknown as FormArray; }

  ngOnInit() {
    // Poderia ter um GET, mas como o endpoint é POST transacional que retorna listas atualizadas,
    // iniciamos vazio e o primeiro salvar pode criar/atualizar/deletar e refletir estados.
  }

  addCategoria(c?: Partial<MarketplaceCategoria>) {
    const g = this.fb.group({
      id: [c?.id ?? null],
      nome: [c?.nome ?? '', Validators.required],
      slug: [c?.slug ?? ''],
      icone: [c?.icone ?? ''],
      remove: [false]
    });
    this.categorias.push(g);
  }
  removeCategoria(i: number) { this.categorias.removeAt(i); }

  addTag(t?: Partial<MarketplaceTag>) {
    const g = this.fb.group({
      id: [t?.id ?? null],
      nome: [t?.nome ?? '', Validators.required],
      remove: [false]
    });
    this.tags.push(g);
  }
  removeTag(i: number) { this.tags.removeAt(i); }

  private buildPayload() {
    const categorias = this.categorias.controls.map((c: any) => {
      const v = c.value;
      if (v.remove && v.id) return { id: Number(v.id), delete: true };
      if (v.id) return { id: Number(v.id), nome: v.nome || undefined, slug: v.slug || undefined, icone: v.icone || undefined };
      return { nome: v.nome, slug: v.slug || undefined, icone: v.icone || undefined };
    });
    const tags = this.tags.controls.map((t: any) => {
      const v = t.value;
      if (v.remove && v.id) return { id: Number(v.id), delete: true };
      if (v.id) return { id: Number(v.id), nome: v.nome || undefined };
      return { nome: v.nome };
    });
    return { categorias, tags };
  }

  save() {
    this.error.set(null); this.success.set(null);
    this.saving.set(true);
    const payload = this.buildPayload();
    this.api.manageMarketplaceCustomizacoes(payload).subscribe({
      next: (res: MarketplaceCustomizacoesResponse) => {
        this.saving.set(false);
        this.success.set('Salvo com sucesso');
        // Reidratar listas com o retorno oficial
        this.categorias.clear();
        (res.categorias || []).forEach(c => this.addCategoria(c));
        this.tags.clear();
        (res.tags || []).forEach(t => this.addTag(t));
      },
      error: () => { this.saving.set(false); this.error.set('Falha ao salvar customizações'); }
    });
  }
}
