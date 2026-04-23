import {
  AfterContentChecked,
  AfterContentInit,
  Component,
  ContentChild,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminListingComponent } from '../admin-listing/admin-listing.component';
import { AdminDrawerComponent } from '../../pages/restrito/admin/shared/admin-drawer/admin-drawer.component';
import { EntityLookupComponent } from '../entity-lookup/entity-lookup.component';
import { CpfInputComponent } from '../form-controls/cpf-input.component';
import { ColumnDef, FormField, FormSchema } from './form-schema';

export type { ColumnDef, FormField, FormSchema } from './form-schema';

/**
 * AdminPageComponent is the shell used by all admin pages. It wraps a
 * listing (table, filters, toolbar, pagination) + an optional side drawer
 * that can render either a projected drawer content or a schema-driven
 * reactive form.
 *
 * This component is selector-aliased as `app-admin-crud` for backwards
 * compatibility during migration — legacy pages keep working unchanged.
 */
@Component({
  selector: 'app-admin-page, app-admin-crud',
  standalone: true,
  imports: [CommonModule, AdminListingComponent, AdminDrawerComponent, ReactiveFormsModule, EntityLookupComponent, CpfInputComponent],
  templateUrl: './admin-page.component.html',
  styleUrls: ['./admin-page.component.scss']
})
export class AdminPageComponent implements AfterContentInit, AfterContentChecked, OnChanges {
  @Output() customAction = new EventEmitter<{ action: string; item: any }>();
  emitCustomAction(evt: { action: string; item: any }) { this.customAction.emit(evt); }

  @Input() items: any[] = [];
  @Input() loading = false;
  @Input() total = 0;
  @Input() page = 1;
  @Input() pageSize = 10;

  @Input() columns: ColumnDef[] | null = null;
  @Input() useDefaultSearch = false;
  @Input() searchPlaceholder = 'Buscar...';
  /** Debounce em ms para o input de busca padrão. */
  @Input() searchDebounceMs = 300;
  /** Rótulo curto exibido no badge de total (ex.: "fórmulas"). */
  @Input() totalLabel = '';
  /** Exibir barra de filtros (slot=filters). Ativado automaticamente quando há conteúdo. */
  @Input() showFilters = true;
  /** Exibe botão "Limpar" na barra de filtros. */
  @Input() showClearFilters = false;
  @Output() clearFilters = new EventEmitter<void>();
  @Output() quickSearch = new EventEmitter<string>();
  private searchDebounce: any = null;

  @Input() drawerOpen = false;
  @Input() drawerWidth = '520px';
  @Input() drawerFull = false;
  @Input() drawerTitle = '';
  @Input() drawerSubtitle?: string;
  @Input() drawerPrimaryLabel?: string;
  @Input() drawerSecondaryLabel = 'Cancelar';
  @Input() drawerHideFooter = false;
  /** Tri-state: null = auto (show when schema auto-form is rendered), true/false = explicit. */
  @Input() drawerShowFooter: boolean | null = null;
  @Input() drawerPrimaryDisabled = false;
  @Input() drawerPrimaryLoading = false;
  @ContentChild('[slot=drawer]', { read: ElementRef }) projectedDrawer?: ElementRef;
  hasProjectedDrawer = false;
  hasProjectedDrawerHeader = false;

  @Input() formSchema: FormSchema | null = null;
  @Input() editItem: any | null = null;
  @Input() formTitle = '';
  @Input() formSubmitLabel = 'Salvar';

  @Output() submit = new EventEmitter<{ id?: any; values: any }>();
  @Output() cancel = new EventEmitter<void>();
  @Output() toggleActive = new EventEmitter<any>();
  /** Quando true, a coluna Ativo/ativo/active vira um switch clicável que abre confirmação e emite `toggleActive`. */
  @Input() tableActiveHotSwap = false;
  @Input() useDefaultActions = false;
  @Input() createLabel = 'Novo';

  /** Modal confirmação troca de status na tabela */
  activeToggleDialogOpen = false;
  activeToggleTarget: any = null;

  @Output() drawerOpenChange = new EventEmitter<boolean>();
  /** Fired when the user clicks the drawer's primary (e.g. Salvar) button. Falls back to emitting `submit` via the auto-form when a schema is active. */
  @Output() drawerPrimaryAction = new EventEmitter<void>();
  /** Fired when the user clicks the drawer's secondary (e.g. Cancelar) button or closes via ESC/backdrop. */
  @Output() drawerSecondaryAction = new EventEmitter<void>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() create = new EventEmitter<void>();
  @Output() edit = new EventEmitter<any>();
  @Output() remove = new EventEmitter<any>();

  autoForm: FormGroup;
  private suppressNextCloseRequest = false;

  constructor(private fb: FormBuilder, private host: ElementRef) {
    this.autoForm = this.fb.group({});
  }

  ngAfterContentInit(): void {
    this.hasProjectedDrawer = !!this.projectedDrawer;
    if (!this.hasProjectedDrawer) {
      try {
        const el = (this.host && (this.host.nativeElement as HTMLElement).querySelector('[slot=drawer]')) as HTMLElement | null;
        if (el) {
          this.hasProjectedDrawer = true;
          if (!this.projectedDrawer) {
            this.projectedDrawer = { nativeElement: el } as any;
          }
        }
      } catch {
        // ignore
      }
    }
  }

  ngAfterContentChecked(): void {
    try {
      const hostEl = this.host && (this.host.nativeElement as HTMLElement);
      const found = hostEl ? (hostEl.querySelector('[slot=drawer]') as HTMLElement | null) : null;
      if (found) {
        this.hasProjectedDrawer = true;
        if (!this.projectedDrawer || (this.projectedDrawer && this.projectedDrawer.nativeElement !== found)) {
          this.projectedDrawer = { nativeElement: found } as any;
        }
      } else {
        this.hasProjectedDrawer = false;
        this.projectedDrawer = undefined;
      }
    } catch {
      // keep previous state
    }

    if (this.projectedDrawer && this.projectedDrawer.nativeElement) {
      try {
        const el = this.projectedDrawer.nativeElement as HTMLElement;
        this.hasProjectedDrawerHeader = !!el.querySelector('.drawer-head');
      } catch {
        this.hasProjectedDrawerHeader = false;
      }
    } else {
      this.hasProjectedDrawerHeader = false;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['formSchema']) this.buildForm();
    if (changes['editItem']) this.patchFormValues();
  }

  buildForm() {
    const fields = this.collectSchemaFields();
    if (!fields.length) { this.autoForm = this.fb.group({}); return; }
    const group: { [k: string]: any } = {};
    fields.forEach((f: FormField) => {
      let defaultVal: any;
      if (this.editItem && this.editItem[f.key] !== undefined) defaultVal = this.editItem[f.key];
      else if (f.default !== undefined) defaultVal = f.default;
      else if (f.type === 'number') defaultVal = 0;
      else if (f.type === 'checkbox') defaultVal = false;
      else if (f.type === 'multi-suggest') defaultVal = [];
      else defaultVal = '';

      const validators: any[] = [];
      if (f.required) {
        if (f.type === 'multi-suggest') {
          validators.push((control: any) => Array.isArray(control.value) && control.value.length ? null : { required: true });
        } else {
          validators.push(Validators.required);
        }
      }
      group[f.key] = [defaultVal, validators];
    });
    this.autoForm = this.fb.group(group);
  }

  patchFormValues() {
    const fields = this.collectSchemaFields();
    if (!fields.length || !this.editItem) return;
    const patch: any = {};
    fields.forEach(f => {
      if (this.editItem[f.key] !== undefined) {
        let val = this.editItem[f.key];
        if (f.type === 'multi-suggest' && Array.isArray(val) && val.length && typeof val[0] === 'object') {
          patch[f.key] = (val as any[]).map(it => it.id ?? it.id);
        } else if (f.type === 'datetime' && val) {
          patch[f.key] = this.toDatetimeLocal(val);
        } else {
          patch[f.key] = val;
        }
      }
    });
    this.autoForm.patchValue(patch);
  }

  private collectSchemaFields(): FormField[] {
    if (!this.formSchema) return [];
    if (this.formSchema.sections?.length) return this.formSchema.sections.flatMap(s => s.fields);
    return this.formSchema.fields || [];
  }

  private toDatetimeLocal(v: any): string {
    if (v == null) return v;
    try {
      const d = v instanceof Date ? v : new Date(String(v));
      if (isNaN(d.getTime())) return String(v);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return String(v);
    }
  }

  getSelectedItems(key: string): Array<{ id: number; name?: string; price?: number }> | undefined {
    if (!this.editItem) return undefined;
    const val = this.editItem[key];
    if (Array.isArray(val) && val.length && typeof val[0] === 'object') return val as Array<{ id: number; name?: string; price?: number }>;
    return undefined;
  }

  onSelectedItemsChange(items: Array<{ id: number; name?: string; price?: number }> | undefined, key: string) {
    if (!this.autoForm) return;
    const ids = Array.isArray(items) ? items.map(it => Number(it.id)) : [];
    const ctrl = this.autoForm.get(key);
    if (ctrl) ctrl.setValue(ids);
  }

  onSubmitAutoForm() {
    if (this.autoForm.invalid) { this.autoForm.markAllAsTouched(); return; }
    this.submit.emit({ id: this.editItem?.id, values: this.autoForm.value });
  }

  onCancelAutoForm() {
    this.suppressNextCloseRequest = true;
    this.cancel.emit();
  }

  /** Resolved label for the drawer primary action. */
  get resolvedPrimaryLabel(): string {
    return this.drawerPrimaryLabel || this.formSubmitLabel || 'Salvar';
  }

  /** Whether the auto-form (schema-driven) is the active content inside the drawer. */
  get isAutoFormActive(): boolean {
    if (this.hasProjectedDrawer) return false;
    return !!(this.formSchema?.fields?.length || this.formSchema?.sections?.length);
  }

  /** Whether the standard drawer footer should be shown. */
  get resolvedShowFooter(): boolean {
    if (this.drawerHideFooter) return false;
    if (this.drawerShowFooter !== null) return this.drawerShowFooter;
    return this.isAutoFormActive;
  }

  onDrawerPrimaryAction() {
    if (this.isAutoFormActive) {
      this.onSubmitAutoForm();
    }
    this.drawerPrimaryAction.emit();
  }

  onDrawerSecondaryAction() {
    if (this.isAutoFormActive) {
      this.onCancelAutoForm();
    } else {
      this.drawerSecondaryAction.emit();
    }
  }

  onSideDrawerCloseRequest(_kind: 'backdrop' | 'esc' | 'programmatic') {
    if (this.suppressNextCloseRequest) {
      this.suppressNextCloseRequest = false;
      return;
    }
    this.cancel.emit();
  }

  onSideDrawerOpenChange(open: boolean) {
    this.drawerOpenChange.emit(open);
  }

  emitEdit(item: any) { this.edit.emit(item); }
  emitCreate() { this.create.emit(); }
  emitRemove(item: any) { this.remove.emit(item); }
  emitClearFilters() { this.clearFilters.emit(); }
  onQuickSearch(ev: Event) {
    const value = (ev.target as HTMLInputElement).value;
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    if (this.searchDebounceMs > 0) {
      this.searchDebounce = setTimeout(() => this.quickSearch.emit(value), this.searchDebounceMs);
    } else {
      this.quickSearch.emit(value);
    }
  }

  hasActiveField(item: any): boolean {
    if (!item) return false;
    return item.ativo !== undefined || item.active !== undefined || item.enabled !== undefined;
  }

  isActive(item: any): boolean {
    if (!item) return false;
    if (item.ativo !== undefined) return item.ativo === 1 || item.ativo === true;
    if (item.active !== undefined) return item.active === 1 || item.active === true;
    if (item.enabled !== undefined) return item.enabled === 1 || item.enabled === true;
    return false;
  }

  activeKeys: string[] = ['ativo', 'active', 'enabled'];

  isActiveColumn(key: string): boolean {
    if (!key) return false;
    try { return this.activeKeys.includes(key.toString().toLowerCase()); } catch { return false; }
  }

  emitToggleActive(item: any) { this.toggleActive.emit(item); }

  get activeToggleItemLabel(): string {
    const it = this.activeToggleTarget;
    if (!it) return '';
    const name = it.name ?? it.nome ?? it.title ?? '';
    const s = name != null ? String(name).trim() : '';
    if (s) return s;
    return it.id != null ? `Registro #${it.id}` : '';
  }

  /** Estado após confirmar (o que o usuário está prestes a aplicar). */
  get activeToggleNextActive(): boolean {
    if (!this.activeToggleTarget) return false;
    return !this.isActive(this.activeToggleTarget);
  }

  onActiveSwitchClicked(item: any, ev: Event) {
    if (!this.tableActiveHotSwap) return;
    ev.preventDefault();
    ev.stopPropagation();
    this.activeToggleTarget = item;
    this.activeToggleDialogOpen = true;
  }

  confirmActiveToggle() {
    const item = this.activeToggleTarget;
    this.closeActiveToggleDialog();
    if (item) this.emitToggleActive(item);
  }

  closeActiveToggleDialog() {
    this.activeToggleDialogOpen = false;
    this.activeToggleTarget = null;
  }
}
