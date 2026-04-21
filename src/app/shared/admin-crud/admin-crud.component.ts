import { Component, ContentChild, ElementRef, EventEmitter, Input, Output, AfterContentInit, AfterContentChecked, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminListingComponent } from '../admin-listing/admin-listing.component';
import { SideDrawerComponent } from '../side-drawer/side-drawer.component';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormSchema, FormField } from './form-schema';
import { EntityLookupComponent } from '../entity-lookup/entity-lookup.component';
import { CpfInputComponent } from '../form-controls/cpf-input.component';

export interface ColumnDef { key: string; label: string; width?: string; class?: string; formatter?: ((item: any) => string) | null }

@Component({
  selector: 'app-admin-crud',
  standalone: true,
  imports: [CommonModule, AdminListingComponent, SideDrawerComponent, ReactiveFormsModule, EntityLookupComponent, CpfInputComponent],
  templateUrl: './admin-crud.component.html',
  styleUrls: ['./admin-crud.component.scss']
})
export class AdminCrudComponent implements AfterContentInit, AfterContentChecked, OnChanges {
  @Output() customAction = new EventEmitter<{action: string, item: any}>();
  emitCustomAction(evt: {action: string, item: any}) { this.customAction.emit(evt); }
  @Input() items: any[] = [];
  @Input() loading = false;
  @Input() total = 0;
  @Input() page = 1;
  @Input() pageSize = 10;

  @Input() columns: ColumnDef[] | null = null;
  @Input() useDefaultSearch = false;
  @Input() searchPlaceholder = 'Buscar...';
  @Output() quickSearch = new EventEmitter<string>();

  @Input() drawerOpen = false;
  @Input() drawerWidth = '520px';
  @Input() drawerFull = false;
  @ContentChild('[slot=drawer]', { read: ElementRef }) projectedDrawer?: ElementRef;
  hasProjectedDrawer = false;
  hasProjectedDrawerHeader = false;

  // auto-form schema
  @Input() formSchema: FormSchema | null = null;
  @Input() editItem: any | null = null;
  @Input() formTitle = '';
  @Input() formSubmitLabel = 'Salvar';

  @Output() submit = new EventEmitter<{ id?: any; values: any }>();
  @Output() cancel = new EventEmitter<void>();
  @Output() toggleActive = new EventEmitter<any>();
  @Input() useDefaultActions = false;
  @Input() createLabel = 'Novo';

  @Output() drawerOpenChange = new EventEmitter<boolean>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() create = new EventEmitter<void>();
  @Output() edit = new EventEmitter<any>();
  @Output() remove = new EventEmitter<any>();
  autoForm: FormGroup;
  private _suppressNextCloseRequest = false;

  constructor(private fb: FormBuilder, private host: ElementRef) {
    this.autoForm = this.fb.group({});
  }

  ngAfterContentInit(): void {
    this.hasProjectedDrawer = !!this.projectedDrawer;
    // fallback: if ContentChild didn't detect the projected element (some runtime scenarios),
    // try a direct DOM query on the host to locate any element with slot="drawer".
    if (!this.hasProjectedDrawer) {
      try {
        const el = (this.host && (this.host.nativeElement as HTMLElement).querySelector('[slot=drawer]')) as HTMLElement | null;
        if (el) {
          this.hasProjectedDrawer = true;
          if (!this.projectedDrawer) {
            this.projectedDrawer = { nativeElement: el } as any;
          }
        }
      } catch (e) {
        // ignore and leave hasProjectedDrawer as-is
      }
    }
    try { console.debug('[AdminCrud] ngAfterContentInit hasProjectedDrawer=', this.hasProjectedDrawer, 'projectedDrawerEl=', !!this.projectedDrawer?.nativeElement); } catch (e) {}
  }

  ngAfterContentChecked(): void {
    // Re-evaluate whether a projected drawer element exists (it can appear/disappear via *ngIf on the host page)
    try {
      const hostEl = this.host && (this.host.nativeElement as HTMLElement);
      const found = hostEl ? (hostEl.querySelector('[slot=drawer]') as HTMLElement | null) : null;
      if (found) {
        this.hasProjectedDrawer = true;
        if (!this.projectedDrawer || (this.projectedDrawer && this.projectedDrawer.nativeElement !== found)) {
          this.projectedDrawer = { nativeElement: found } as any;
        }
      } else {
        // no projected drawer currently in the light DOM
        this.hasProjectedDrawer = false;
        this.projectedDrawer = undefined;
      }
    } catch (e) {
      // keep previous state on error
    }

    // detect whether the projected drawer already provides its own header
    if (this.projectedDrawer && this.projectedDrawer.nativeElement) {
      try {
        const el = this.projectedDrawer.nativeElement as HTMLElement;
        this.hasProjectedDrawerHeader = !!el.querySelector('.drawer-head');
      } catch (e) {
        this.hasProjectedDrawerHeader = false;
      }
    } else {
      this.hasProjectedDrawerHeader = false;
    }
    try { console.debug('[AdminCrud] ngAfterContentChecked hasProjectedDrawer=', this.hasProjectedDrawer, 'hasHeader=', this.hasProjectedDrawerHeader); } catch (e) {}
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['formSchema']) this.buildForm();
    if (changes['editItem']) this.patchFormValues();
  }

  buildForm() {
    if (!this.formSchema?.fields) { this.autoForm = this.fb.group({}); return; }
    const group: { [k: string]: any } = {};
    this.formSchema.fields.forEach((f: FormField) => {
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
    if (!this.formSchema?.fields || !this.editItem) return;
    const patch: any = {};
    this.formSchema.fields.forEach((f) => {
      if (this.editItem[f.key] !== undefined) {
        let val = this.editItem[f.key];
        // If the field is a multi-suggest and the editItem provides objects, convert to ID array for the form control
        if (f.type === 'multi-suggest' && Array.isArray(val) && val.length && typeof val[0] === 'object') {
          patch[f.key] = (val as any[]).map(it => it.id ?? it.id);
        } else if (f.type === 'datetime' && val) {
          // Convert ISO/UTC datetime strings to local 'yyyy-MM-ddTHH:mm' for datetime-local inputs
          patch[f.key] = this.toDatetimeLocal(val);
        } else {
          patch[f.key] = val;
        }
      }
    });
    this.autoForm.patchValue(patch);
  }

  // Convert ISO datetime (or Date) to local datetime-local string (YYYY-MM-DDTHH:mm)
  private toDatetimeLocal(v: any): string {
    if (v == null) return v;
    try {
      const d = (v instanceof Date) ? v : new Date(String(v));
      if (isNaN(d.getTime())) return String(v);
      const pad = (n: number) => n.toString().padStart(2, '0');
      const year = d.getFullYear();
      const month = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      const hours = pad(d.getHours());
      const minutes = pad(d.getMinutes());
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (e) {
      return String(v);
    }
  }

  // Helper: return rich selected items (objects) for a given form key when editItem provides them
  // Return `undefined` when no rich items are available to match `EntityLookup.selectedItems` typing.
  getSelectedItems(key: string): Array<{ id: number; name?: string; price?: number }> | undefined {
    if (!this.editItem) return undefined;
    const val = this.editItem[key];
    if (Array.isArray(val) && val.length && typeof val[0] === 'object') return val as Array<{ id: number; name?: string; price?: number }>;
    return undefined;
  }

  // Handler called when EntityLookup emits selectedItemsChange. We update the form field with IDs.
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
    // When the user clicks the Cancel button we emit cancel and set a flag to
    // avoid treating the subsequent drawer close event (which the parent may
    // trigger) as an additional "user-initiated" cancel.
    this._suppressNextCloseRequest = true;
    this.cancel.emit();
  }

  // Called when SideDrawer emits a close request (backdrop or ESC).
  onSideDrawerCloseRequest(kind: 'backdrop'|'esc'|'programmatic') {
    if (this._suppressNextCloseRequest) {
      this._suppressNextCloseRequest = false;
      return;
    }
    // Emit cancel so pages that only listen to (cancel) will react to backdrop/esc closes.
    this.cancel.emit();
  }

  // Called when SideDrawer open state changes; forward to parent to preserve API.
  onSideDrawerOpenChange(open: boolean) {
    this.drawerOpenChange.emit(open);
  }

  emitEdit(item: any) { this.edit.emit(item); }
  emitCreate() { this.create.emit(); }
  emitRemove(item: any) { this.remove.emit(item); }
  onQuickSearch(ev: Event) { this.quickSearch.emit((ev.target as HTMLInputElement).value); }

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

  // Recognized column keys treated as "active" indicators (rendered as read-only radio)
  activeKeys: string[] = ['ativo', 'active', 'enabled'];

  isActiveColumn(key: string): boolean {
    if (!key) return false;
    try { return this.activeKeys.includes(key.toString().toLowerCase()); } catch (e) { return false; }
  }

  emitToggleActive(item: any) { this.toggleActive.emit(item); }
}
