import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray } from '@angular/forms';
import { ButtonDirective, ButtonComponent } from '../../../../shared/button';
import { AdminApiService, MarketplaceCategoria, MarketplaceTag, MarketplaceCustomizacoesResponse, MarketplaceCustomizacoesList } from '../../../../services/admin-api.service';

@Component({
  selector: 'app-admin-marketplace-customizacoes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonDirective, ButtonComponent],
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
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.api.getMarketplaceCustomizacoes().subscribe({
      next: (res: MarketplaceCustomizacoesList) => {
        this.categorias.clear();
        (res.categorias || []).forEach(c => this.addCategoria(c));
        this.tags.clear();
        (res.tags || []).forEach(t => this.addTag(t));
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.error.set('Falha ao carregar customizações'); }
    });
  }

  addCategoria(c?: Partial<MarketplaceCategoria>) {
    const g = this.fb.group({
      id: [c?.id ?? null],
      nome: [c?.nome ?? '', Validators.required],
      slug: [c?.slug ?? ''],
      icone: [c?.icone ?? ''],
      remove: [false],
      selected: [false],
      disabled: [false]
    });
    this.categorias.push(g);
  }
  removeCategoria(i: number) {
    const g = this.categorias.at(i);
    const id = g?.get('id')?.value;
    if (id) {
      g.patchValue({ remove: true, selected: false });
    } else {
      this.categorias.removeAt(i);
    }
  }

  addTag(t?: Partial<MarketplaceTag>) {
    const g = this.fb.group({
      id: [t?.id ?? null],
      nome: [t?.nome ?? '', Validators.required],
      remove: [false],
      selected: [false],
      disabled: [false]
    });
    this.tags.push(g);
  }
  removeTag(i: number) {
    const g = this.tags.at(i);
    const id = g?.get('id')?.value;
    if (id) {
      g.patchValue({ remove: true, selected: false });
    } else {
      this.tags.removeAt(i);
    }
  }

  // Selection helpers
  selectedCount() {
    const cat = this.categorias.controls.reduce((acc: number, c: any) => acc + (c.get('selected')?.value ? 1 : 0), 0);
    const tag = this.tags.controls.reduce((acc: number, t: any) => acc + (t.get('selected')?.value ? 1 : 0), 0);
    return cat + tag;
  }
  areAnySelected() { return this.selectedCount() > 0; }
  areAllSelectedCategories() {
    const total = this.categorias.length;
    return total > 0 && this.categorias.controls.every((c: any) => c.get('selected')?.value);
  }
  toggleSelectAllCategories(checked: boolean) {
    this.categorias.controls.forEach((c: any) => c.patchValue({ selected: checked }));
  }

  areAllSelectedTags() {
    const total = this.tags.length;
    return total > 0 && this.tags.controls.every((t: any) => t.get('selected')?.value);
  }
  toggleSelectAllTags(checked: boolean) {
    this.tags.controls.forEach((t: any) => t.patchValue({ selected: checked }));
  }

  bulkDeleteSelected() {
    const count = this.selectedCount();
    if (!count) return;
    if (!confirm(`Confirmar exclusão de ${count} itens selecionados?`)) return;
    const catRemoveIdx: number[] = [];
    this.categorias.controls.forEach((c: any, i: number) => {
      const v = c.value;
      if (v.selected) {
        if (v.id) {
          c.patchValue({ remove: true, selected: false });
        } else {
          catRemoveIdx.push(i);
        }
      }
    });
    catRemoveIdx.sort((a,b)=>b-a).forEach(i=> this.categorias.removeAt(i));

    const tagRemoveIdx: number[] = [];
    this.tags.controls.forEach((t: any, i: number) => {
      const v = t.value;
      if (v.selected) {
        if (v.id) {
          t.patchValue({ remove: true, selected: false });
        } else {
          tagRemoveIdx.push(i);
        }
      }
    });
    tagRemoveIdx.sort((a,b)=>b-a).forEach(i=> this.tags.removeAt(i));

    this.save();
  }

  bulkDisableSelected() {
    const count = this.selectedCount();
    if (!count) return;
    if (!confirm(`Confirmar desativação de ${count} itens selecionados?`)) return;
    this.categorias.controls.forEach((c: any) => {
      if (c.value.selected) c.patchValue({ disabled: true, selected: false });
    });
    this.tags.controls.forEach((t: any) => {
      if (t.value.selected) t.patchValue({ disabled: true, selected: false });
    });
    this.save();
  }

  private buildPayload() {
    const categorias = this.categorias.controls.map((c: any) => {
      const v = c.value;
      if (v.remove && v.id) return { id: Number(v.id), delete: true };
      if (v.disabled && v.id) return { id: Number(v.id), disabled: true };
      if (v.id) return { id: Number(v.id), nome: v.nome || undefined, slug: v.slug || undefined, icone: v.icone || undefined };
      if (v.disabled) return { nome: v.nome, slug: v.slug || undefined, icone: v.icone || undefined, disabled: true };
      return { nome: v.nome, slug: v.slug || undefined, icone: v.icone || undefined };
    });
    const tags = this.tags.controls.map((t: any) => {
      const v = t.value;
      if (v.remove && v.id) return { id: Number(v.id), delete: true };
      if (v.disabled && v.id) return { id: Number(v.id), disabled: true };
      if (v.id) return { id: Number(v.id), nome: v.nome || undefined };
      if (v.disabled) return { nome: v.nome, disabled: true };
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
