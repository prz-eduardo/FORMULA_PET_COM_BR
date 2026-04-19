import { Component, ContentChild, ElementRef, EventEmitter, Input, Output, AfterContentInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminListingComponent } from '../admin-listing/admin-listing.component';
import { SideDrawerComponent } from '../side-drawer/side-drawer.component';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormSchema, FormField } from './form-schema';
import { EntityLookupComponent } from '../entity-lookup/entity-lookup.component';

export interface ColumnDef { key: string; label: string; width?: string; class?: string; formatter?: ((item: any) => string) | null }

@Component({
  selector: 'app-admin-crud',
  standalone: true,
  imports: [CommonModule, AdminListingComponent, SideDrawerComponent, ReactiveFormsModule, EntityLookupComponent],
  templateUrl: './admin-crud.component.html',
  styleUrls: ['./admin-crud.component.scss']
})
export class AdminCrudComponent implements AfterContentInit, OnChanges {
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
  @ContentChild('[slot=drawer]', { read: ElementRef }) projectedDrawer?: ElementRef;
  hasProjectedDrawer = false;

  // auto-form schema
  @Input() formSchema: FormSchema | null = null;
  @Input() editItem: any | null = null;
  @Input() formTitle = '';
  @Input() formSubmitLabel = 'Salvar';

  @Output() submit = new EventEmitter<{ id?: any; values: any }>();
  @Output() cancel = new EventEmitter<void>();
  @Input() useDefaultActions = false;
  @Input() createLabel = 'Novo';

  @Output() drawerOpenChange = new EventEmitter<boolean>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() create = new EventEmitter<void>();
  @Output() edit = new EventEmitter<any>();
  @Output() remove = new EventEmitter<any>();
  autoForm: FormGroup;
  private _suppressNextCloseRequest = false;

  constructor(private fb: FormBuilder) {
    this.autoForm = this.fb.group({});
  }

  ngAfterContentInit(): void { this.hasProjectedDrawer = !!this.projectedDrawer; }

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
    this.formSchema.fields.forEach((f) => { if (this.editItem[f.key] !== undefined) patch[f.key] = this.editItem[f.key]; });
    this.autoForm.patchValue(patch);
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
}
