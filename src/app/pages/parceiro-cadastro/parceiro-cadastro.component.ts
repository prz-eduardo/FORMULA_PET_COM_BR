import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-parceiro-cadastro',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './parceiro-cadastro.component.html',
  styleUrls: ['./parceiro-cadastro.component.scss']
})
export class ParceiroCadastroComponent implements OnInit {
  form!: FormGroup;
  loading = false;
  types: Array<{ id: string; nome?: string; label?: string }> = [];

  constructor(private fb: FormBuilder, private api: ApiService, private toast: ToastService) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      nome: ['', [Validators.required, Validators.minLength(2)]],
      tipo: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      telefone: ['', Validators.required],
      cep: ['', Validators.required],
      endereco: ['', Validators.required],
      numero: [''],
      complemento: [''],
      cidade: [''],
      estado: [''],
      latitude: [''],
      longitude: [''],
      descricao: [''],
      logo: [''],
      cnpj: ['']
    });

    this.api.getProfessionalTypes().subscribe({ next: (res) => { this.types = res?.types || []; }, error: () => { this.types = []; } });
  }

  private onlyDigits(v: string) {
    return (v || '').replace(/\D/g, '');
  }

  formatCep(digitsOrValue: string) {
    const d = this.onlyDigits(digitsOrValue).slice(0, 8);
    if (!d) return '';
    if (d.length <= 5) return d;
    return d.slice(0, 5) + '-' + d.slice(5);
  }

  onCepInput(e: any) {
    const raw = e?.target?.value || '';
    const digits = this.onlyDigits(raw).slice(0, 8);
    const masked = this.formatCep(digits);
    this.form.get('cep')?.setValue(masked, { emitEvent: false });
    if (digits.length === 8) {
      this.lookupCep(digits);
    }
  }

  lookupCep(cepDigits: string) {
    this.api.buscarCepViaCep(cepDigits).subscribe({
      next: (res: any) => {
        if (!res || res.erro) {
          this.toast.error('CEP não encontrado.');
          return;
        }
        const enderecoText = `${res.logradouro || ''}${res.bairro ? ', ' + res.bairro : ''}`.trim();
        if (enderecoText) this.form.get('endereco')?.setValue(enderecoText);
        if (res.localidade) this.form.get('cidade')?.setValue(res.localidade);
        if (res.uf) this.form.get('estado')?.setValue(res.uf);

        const fullAddress = `${res.logradouro || ''} ${res.bairro || ''} ${res.localidade || ''} ${res.uf || ''} Brasil`.trim();
        if (fullAddress.replace(/\s/g, '') !== '') {
          this.api.geocodeAddress(fullAddress).subscribe({
            next: (geo: any[]) => {
              if (geo && geo.length > 0) {
                this.form.get('latitude')?.setValue(geo[0].lat);
                this.form.get('longitude')?.setValue(geo[0].lon);
              }
            },
            error: () => {}
          });
        }
      },
      error: (err) => {
        console.error(err);
        this.toast.error('Erro ao consultar CEP.');
      }
    });
  }

  formatTelefone(value: string) {
    const d = this.onlyDigits(value).slice(0, 11);
    if (!d) return '';
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
  }

  onTelefoneInput(e: any) {
    const raw = e?.target?.value || '';
    const masked = this.formatTelefone(raw);
    this.form.get('telefone')?.setValue(masked, { emitEvent: false });
  }

  formatCnpj(value: string) {
    const d = this.onlyDigits(value).slice(0, 14);
    if (!d) return '';
    if (d.length <= 2) return d;
    if (d.length <= 5) return d.slice(0, 2) + '.' + d.slice(2);
    if (d.length <= 8) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5);
    if (d.length <= 12) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8);
    return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8, 12) + '-' + d.slice(12);
  }

  onCnpjInput(e: any) {
    const raw = e?.target?.value || '';
    const masked = this.formatCnpj(raw);
    this.form.get('cnpj')?.setValue(masked, { emitEvent: false });
  }

  logoPreview: string | null = null;

  onLogoSelected(e: any) {
    const file: File = e?.target?.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      this.toast.error('Formato de arquivo inválido. Envie uma imagem.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.toast.error('Imagem muito grande. Máx 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      this.logoPreview = dataUrl;
      this.form.get('logo')?.setValue(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    const raw = this.form.value;
    const payload = {
      ...raw,
      cep: this.onlyDigits(raw.cep),
      telefone: this.onlyDigits(raw.telefone),
      cnpj: raw.cnpj ? this.onlyDigits(raw.cnpj) : undefined,
      logo: raw.logo || undefined,
      latitude: raw.latitude ? Number(raw.latitude) : undefined,
      longitude: raw.longitude ? Number(raw.longitude) : undefined,
      status: 'pending'
    };
    this.api.registerAnunciante(payload).subscribe({
      next: (res) => {
        this.loading = false;
        this.toast.success('Cadastro enviado com sucesso. Aguardando aprovação.');
        this.form.reset();
        this.logoPreview = null;
      },
      error: (err) => {
        this.loading = false;
        this.toast.error('Erro ao enviar cadastro.');
        console.error(err);
      }
    });
  }
}
