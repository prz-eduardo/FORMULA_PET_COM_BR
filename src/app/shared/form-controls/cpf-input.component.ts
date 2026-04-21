import { Component, forwardRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NG_VALIDATORS, Validator, AbstractControl, ValidationErrors } from '@angular/forms';

function cpfMask(value: string): string {
  if (!value) return '';
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    .substring(0, 14);
}

function validateCPF(cpf: string): boolean {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11 || /^([0-9])\1+$/.test(cpf)) return false;
  let sum = 0, rest;
  for (let i = 1; i <= 9; i++) sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf.substring(9, 10))) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === parseInt(cpf.substring(10, 11));
}

@Component({
  selector: 'app-cpf-input',
  standalone: true,
  imports: [CommonModule],
  template: `
    <input [value]="maskedValue" (input)="onInput($event)" (blur)="onTouched()" [placeholder]="placeholder" type="text" class="cpf-input" />
    <div class="error" *ngIf="showError">CPF inválido</div>
  `,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CpfInputComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => CpfInputComponent), multi: true }
  ],
  styleUrls: ['./cpf-input.component.scss']
})
export class CpfInputComponent implements ControlValueAccessor, Validator {
  @Input() placeholder = 'CPF';
  maskedValue = '';
  private rawValue = '';
  private onChange = (_: any) => {};
  onTouched = () => {};
  showError = false;

  writeValue(value: any): void {
    this.rawValue = value || '';
    this.maskedValue = cpfMask(this.rawValue);
  }
  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState?(isDisabled: boolean): void {}

  onInput(event: any) {
    const value = event.target.value.replace(/\D/g, '');
    this.rawValue = value;
    this.maskedValue = cpfMask(value);
    this.onChange(this.rawValue);
    this.showError = false;
  }

  validate(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    const valid = validateCPF(control.value);
    this.showError = !valid && control.touched;
    return valid ? null : { cpf: true };
  }
}
