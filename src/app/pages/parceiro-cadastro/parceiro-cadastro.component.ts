import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';

// ------------------------------ Validadores ------------------------------
function onlyDigitsFn(v: any): string {
  return String(v ?? '').replace(/\D/g, '');
}

function cnpjValidator(ctrl: AbstractControl): ValidationErrors | null {
  const raw = onlyDigitsFn(ctrl.value);
  if (!raw) return null; // opcional
  if (raw.length !== 14) return { cnpjFormat: true };
  if (/^(\d)\1{13}$/.test(raw)) return { cnpjInvalid: true };
  const calc = (base: string) => {
    let sum = 0;
    let pos = base.length - 7;
    for (let i = 0; i < base.length; i++) {
      sum += Number(base[i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const res = sum % 11;
    return res < 2 ? 0 : 11 - res;
  };
  const d1 = calc(raw.slice(0, 12));
  const d2 = calc(raw.slice(0, 12) + d1);
  return d1 === Number(raw[12]) && d2 === Number(raw[13]) ? null : { cnpjInvalid: true };
}

const passwordMatchValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const senha = group.get('senha')?.value;
  const confirm = group.get('confirmSenha')?.value;
  if (!senha || !confirm) return null;
  return senha === confirm ? null : { passwordMismatch: true };
};

const strongPasswordValidator: ValidatorFn = (ctrl: AbstractControl): ValidationErrors | null => {
  const v = String(ctrl.value ?? '');
  if (!v) return null;
  const errs: any = {};
  if (v.length < 8) errs.minLength = true;
  if (!/[A-Za-z]/.test(v)) errs.needLetter = true;
  if (!/\d/.test(v)) errs.needDigit = true;
  return Object.keys(errs).length ? errs : null;
};

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
  submitted = false;
  success = false;
  showPwd = false;
  showPwd2 = false;
  serverError = '';
  serverFieldErrors: Record<string, string> = {};
  types: Array<{ id: string; nome?: string; label?: string }> = [];

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private toast: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group(
      {
        nome: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
        tipo: ['', Validators.required],
        email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
        telefone: ['', [Validators.required, Validators.minLength(14)]],
        cep: ['', [Validators.required, Validators.minLength(9)]],
        endereco: ['', Validators.required],
        numero: [''],
        complemento: [''],
        bairro: [''],
        cidade: [''],
        estado: [''],
        latitude: [''],
        longitude: [''],
        descricao: ['', Validators.maxLength(1000)],
        logo: [''],
        cnpj: ['', [cnpjValidator]],
        senha: ['', [Validators.required, strongPasswordValidator]],
        confirmSenha: ['', [Validators.required]],
        aceitoTermos: [false, [Validators.requiredTrue]],
      },
      { validators: [passwordMatchValidator] }
    );

    this.api.getProfessionalTypes().subscribe({
      next: (res) => { this.types = res?.types || []; },
      error: () => { this.types = []; }
    });
  }

  // ------------------------------ Getters ------------------------------
  get f() { return this.form.controls; }
  hasError(name: string, err?: string): boolean {
    const c = this.form.get(name);
    if (!c) return false;
    if (!c.touched && !this.submitted) return false;
    if (err) return !!c.hasError(err);
    return c.invalid;
  }
  get passwordMismatch(): boolean {
    return !!(this.form.errors?.['passwordMismatch']
      && (this.form.get('confirmSenha')?.touched || this.submitted));
  }

  // ------------------------------ Máscaras ------------------------------
  private onlyDigits(v: string) { return onlyDigitsFn(v); }

  formatCep(v: string) {
    const d = this.onlyDigits(v).slice(0, 8);
    if (!d) return '';
    return d.length <= 5 ? d : d.slice(0, 5) + '-' + d.slice(5);
  }
  onCepInput(e: any) {
    const digits = this.onlyDigits(e?.target?.value || '').slice(0, 8);
    this.form.get('cep')?.setValue(this.formatCep(digits), { emitEvent: false });
    if (digits.length === 8) this.lookupCep(digits);
  }

  lookupCep(cepDigits: string) {
    this.api.buscarCepViaCep(cepDigits).subscribe({
      next: (res: any) => {
        if (!res || res.erro) { this.toast.error('CEP não encontrado.'); return; }
        const enderecoText = `${res.logradouro || ''}`.trim();
        if (enderecoText) this.form.get('endereco')?.setValue(enderecoText);
        if (res.bairro) this.form.get('bairro')?.setValue(res.bairro);
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
      error: (err) => { console.error(err); this.toast.error('Erro ao consultar CEP.'); }
    });
  }

  formatTelefone(v: string) {
    const d = this.onlyDigits(v).slice(0, 11);
    if (!d) return '';
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
  }
  onTelefoneInput(e: any) {
    const masked = this.formatTelefone(e?.target?.value || '');
    this.form.get('telefone')?.setValue(masked, { emitEvent: false });
  }

  formatCnpj(v: string) {
    const d = this.onlyDigits(v).slice(0, 14);
    if (!d) return '';
    if (d.length <= 2) return d;
    if (d.length <= 5) return d.slice(0, 2) + '.' + d.slice(2);
    if (d.length <= 8) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5);
    if (d.length <= 12) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8);
    return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8, 12) + '-' + d.slice(12);
  }
  onCnpjInput(e: any) {
    const masked = this.formatCnpj(e?.target?.value || '');
    this.form.get('cnpj')?.setValue(masked, { emitEvent: false });
  }

  // ------------------------------ Logo ------------------------------
  logoPreview: string | null = null;
  onLogoSelected(e: any) {
    const file: File = e?.target?.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith('image/')) { this.toast.error('Formato inválido. Envie uma imagem.'); return; }
    if (file.size > 2 * 1024 * 1024) { this.toast.error('Imagem muito grande. Máx 2MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      this.logoPreview = dataUrl;
      this.form.get('logo')?.setValue(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  // ------------------------------ Submit ------------------------------
  submit() {
    this.submitted = true;
    this.serverError = '';
    this.serverFieldErrors = {};

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Verifique os campos destacados.');
      return;
    }

    this.loading = true;
    const raw = this.form.value;
    const payload: any = {
      nome: raw.nome?.trim(),
      tipo: raw.tipo,
      email: String(raw.email || '').trim().toLowerCase(),
      telefone: this.onlyDigits(raw.telefone),
      cep: this.onlyDigits(raw.cep),
      endereco: raw.endereco?.trim(),
      numero: raw.numero?.trim() || undefined,
      complemento: raw.complemento?.trim() || undefined,
      bairro: raw.bairro?.trim() || undefined,
      cidade: raw.cidade?.trim() || undefined,
      estado: raw.estado ? String(raw.estado).trim().toUpperCase() : undefined,
      descricao: raw.descricao?.trim() || undefined,
      logo: raw.logo || undefined,
      cnpj: raw.cnpj ? this.onlyDigits(raw.cnpj) : undefined,
      latitude: raw.latitude ? Number(raw.latitude) : undefined,
      longitude: raw.longitude ? Number(raw.longitude) : undefined,
      senha: raw.senha,
    };

    this.api.registerAnunciante(payload).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (!res) {
          this.serverError = 'Não foi possível enviar o cadastro. Tente novamente.';
          this.toast.error(this.serverError);
          return;
        }
        this.success = true;
        this.toast.success('Cadastro enviado com sucesso! Aguarde a aprovação do administrador.');
        this.form.reset();
        this.logoPreview = null;
        this.submitted = false;
      },
      error: (err) => {
        this.loading = false;
        const payloadErr = err?.error;
        if (payloadErr?.fields && Array.isArray(payloadErr.fields)) {
          for (const f of payloadErr.fields) {
            if (f?.field && f?.msg) this.serverFieldErrors[f.field] = f.msg;
          }
        }
        this.serverError = payloadErr?.error || payloadErr?.message || 'Erro ao enviar cadastro.';
        this.toast.error(this.serverError);
      }
    });
  }

  irParaLogin() {
    this.router.navigateByUrl('/restrito/login');
  }
}
