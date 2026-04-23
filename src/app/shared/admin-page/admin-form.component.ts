import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormField, FormSchema } from './form-schema';
import { EntityLookupComponent } from '../entity-lookup/entity-lookup.component';
import { CpfInputComponent } from '../form-controls/cpf-input.component';

/**
 * Schema-driven reactive form. Converts a FormSchema into a FormGroup and
 * renders the appropriate control for each field (text/number/select/
 * checkbox/datetime/multi-suggest/cpf/…). Pages listen to `(submit)` to
 * receive the serialized values and `(cancel)` for the cancel button.
 */
@Component({
  selector: 'app-admin-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EntityLookupComponent, CpfInputComponent],
  templateUrl: './admin-form.component.html',
  styleUrls: ['./admin-form.component.scss']
})
export class AdminFormComponent implements OnChanges {
  @Input() schema: FormSchema | null = null;
  @Input() editItem: any | null = null;
  @Input() submitLabel = 'Salvar';
  @Input() cancelLabel = 'Cancelar';
  @Input() showActions = true;

  @Output() submit = new EventEmitter<{ id?: any; values: any }>();
  @Output() cancel = new EventEmitter<void>();

  form: FormGroup;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({});
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['schema']) this.buildForm();
    if (changes['editItem']) this.patchValues();
  }

  buildForm() {
    if (!this.schema) {
      this.form = this.fb.group({});
      return;
    }
    const fields = this.collectFields();
    if (!fields.length) {
      this.form = this.fb.group({});
      return;
    }
    const group: { [k: string]: any } = {};
    fields.forEach(f => {
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
    this.form = this.fb.group(group);
  }

  patchValues() {
    if (!this.schema || !this.editItem) return;
    const patch: any = {};
    this.collectFields().forEach(f => {
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
    this.form.patchValue(patch);
  }

  private collectFields(): FormField[] {
    if (!this.schema) return [];
    if (this.schema.sections?.length) return this.schema.sections.flatMap(s => s.fields);
    return this.schema.fields || [];
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
    if (!this.form) return;
    const ids = Array.isArray(items) ? items.map(it => Number(it.id)) : [];
    const ctrl = this.form.get(key);
    if (ctrl) ctrl.setValue(ids);
  }

  onSubmit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submit.emit({ id: this.editItem?.id, values: this.form.value });
  }

  onCancel() { this.cancel.emit(); }
}
