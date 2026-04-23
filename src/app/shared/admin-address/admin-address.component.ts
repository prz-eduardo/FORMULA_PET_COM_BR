import { CommonModule } from '@angular/common';
import { Component, Input, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { cepDigitsOnly, formatCepDisplay, lookupCep } from './admin-address.helper';

@Component({
  selector: 'app-admin-address',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-address.component.html',
  styleUrls: ['./admin-address.component.scss']
})
export class AdminAddressComponent {
  @Input({ required: true }) group!: FormGroup;
  /** Quando true, exibe título h4 (a maioria dos ecrãs usa só fx-section__head). */
  @Input() showHeading = false;
  @Input() title = 'Endereço';

  loading = signal(false);
  error = signal<string | null>(null);

  constructor(private api: ApiService) {}

  onCepInput(ev: Event) {
    const el = ev.target as HTMLInputElement | null;
    if (!el) return;
    const masked = formatCepDisplay(el.value);
    el.value = masked;
    this.group.get('cep')?.setValue(masked, { emitEvent: false });
    this.error.set(null);
  }

  onUfInput(ev: Event) {
    const el = ev.target as HTMLInputElement | null;
    if (!el) return;
    const up = (el.value || '').toUpperCase().slice(0, 2);
    el.value = up;
    this.group.get('uf')?.setValue(up, { emitEvent: false });
  }

  buscar() {
    const cep = this.group.get('cep')?.value || '';
    const clean = cepDigitsOnly(cep);
    if (clean.length !== 8) {
      this.error.set('CEP inválido (8 dígitos).');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    lookupCep(this.api, clean).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (!res) { this.error.set('CEP não encontrado.'); return; }
        this.group.patchValue({
          cep: res.cep,
          logradouro: res.logradouro,
          complemento: res.complemento,
          bairro: res.bairro,
          city: res.city,
          uf: res.uf
        });
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Falha ao buscar CEP.');
      }
    });
  }
}
