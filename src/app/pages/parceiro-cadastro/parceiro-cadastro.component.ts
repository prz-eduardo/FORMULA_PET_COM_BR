import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
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
export class ParceiroCadastroComponent implements OnInit, OnDestroy {
  // ---- Wizard state ----
  currentStep = 1;
  readonly TOTAL_STEPS = 5;

  // ---- Forms per step ----
  formBasico!: FormGroup;
  formEndereco!: FormGroup;
  formEmail!: FormGroup;
  formSenha!: FormGroup;

  // ---- Step-level submission flags ----
  submittedBasico = false;
  submittedEndereco = false;
  submittedEmail = false;
  submittedSenha = false;

  // ---- Final submit state ----
  loading = false;
  success = false;
  serverError = '';
  serverFieldErrors: Record<string, string> = {};

  // ---- Password visibility ----
  showPwd = false;
  showPwd2 = false;

  // ---- Logo ----
  logoPreview: string | null = null;
  logoFileName: string | null = null;

  // ---- Email verification ----
  codeSent = false;
  codeVerified = false;
  sendingCode = false;
  verifyingCode = false;
  codeError = '';
  codeSuccess = '';
  resendCountdown = 0;
  private resendTimer: any = null;

  // ---- Prefill (Google Maps) ----
  claimSource: 'google' | null = null;
  claimPlaceId: string | null = null;
  types: Array<{ id: string; nome?: string; label?: string }> = [];

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private toast: ToastService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.formBasico = this.fb.group({
      nome: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
      tipo: ['', Validators.required],
      cnpj: ['', [cnpjValidator]],
      telefone: ['', [Validators.required, Validators.minLength(14)]],
      descricao: ['', Validators.maxLength(1000)],
      logo: [''],
    });

    this.formEndereco = this.fb.group({
      cep: ['', [Validators.required, Validators.minLength(9)]],
      endereco: ['', Validators.required],
      numero: [''],
      complemento: [''],
      bairro: [''],
      cidade: [''],
      estado: [''],
      latitude: [''],
      longitude: [''],
    });

    this.formEmail = this.fb.group({
      email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    });

    this.formSenha = this.fb.group(
      {
        senha: ['', [Validators.required, strongPasswordValidator]],
        confirmSenha: ['', [Validators.required, strongPasswordValidator]],
        aceitoTermos: [false, [Validators.requiredTrue]],
      },
      { validators: [passwordMatchValidator] }
    );

    this.api.getProfessionalTypes().subscribe({
      next: (res) => {
        this.types = res?.types || [];
        this.applyPrefillFromQueryParams();
      },
      error: () => { this.types = []; }
    });

    this.applyPrefillFromQueryParams();
  }

  ngOnDestroy(): void {
    if (this.resendTimer) clearInterval(this.resendTimer);
  }

  // ------------------------------ Step labels ------------------------------
  get stepLabels(): string[] {
    return ['Dados básicos', 'Endereço', 'E-mail', 'Senha', 'Confirmar'];
  }

  // ------------------------------ Navigation ------------------------------
  goToStep(step: number): void {
    if (step < this.currentStep) this.currentStep = step;
  }

  nextStep(): void {
    if (this.currentStep === 1) {
      this.submittedBasico = true;
      if (this.formBasico.invalid) { this.formBasico.markAllAsTouched(); this.toast.error('Verifique os campos destacados.'); return; }
    }
    if (this.currentStep === 2) {
      this.submittedEndereco = true;
      if (this.formEndereco.invalid) { this.formEndereco.markAllAsTouched(); this.toast.error('Verifique os campos de endereço.'); return; }
    }
    if (this.currentStep === 3) {
      this.submittedEmail = true;
      if (this.formEmail.invalid) { this.formEmail.markAllAsTouched(); this.toast.error('Informe um e-mail válido.'); return; }
      if (!this.codeVerified) { this.toast.error('Confirme seu e-mail com o código enviado.'); return; }
    }
    if (this.currentStep === 4) {
      this.submittedSenha = true;
      if (this.formSenha.invalid) { this.formSenha.markAllAsTouched(); this.toast.error('Verifique os campos de senha.'); return; }
    }
    if (this.currentStep < this.TOTAL_STEPS) this.currentStep++;
  }

  prevStep(): void {
    if (this.currentStep > 1) this.currentStep--;
  }

  // ------------------------------ Step 3: Email verification ------------------------------
  get emailValue(): string {
    return String(this.formEmail.get('email')?.value || '').trim().toLowerCase();
  }

  sendCode(): void {
    this.submittedEmail = true;
    if (this.formEmail.invalid) { this.formEmail.markAllAsTouched(); return; }
    this.sendingCode = true;
    this.codeError = '';
    this.codeSuccess = '';
    this.codeSent = false;
    this.codeVerified = false;

    this.api.sendParceiroEmailVerificacao(this.emailValue).subscribe({
      next: () => {
        this.sendingCode = false;
        this.codeSent = true;
        this.toast.success('Código enviado! Verifique seu e-mail.');
        this.startResendCountdown();
      },
      error: (err) => {
        this.sendingCode = false;
        this.codeError = err?.error?.error || 'Não foi possível enviar o código. Tente novamente.';
        this.toast.error(this.codeError);
      },
    });
  }

  verifyCode(codigo: string): void {
    if (!/^\d{6}$/.test(codigo)) { this.codeError = 'Digite os 6 dígitos do código.'; return; }
    this.verifyingCode = true;
    this.codeError = '';
    this.api.verifyParceiroEmailCode(this.emailValue, codigo).subscribe({
      next: () => {
        this.verifyingCode = false;
        this.codeVerified = true;
        this.codeSuccess = 'E-mail verificado com sucesso!';
      },
      error: (err) => {
        this.verifyingCode = false;
        this.codeError = err?.error?.error || 'Código incorreto ou expirado.';
      },
    });
  }

  private startResendCountdown(): void {
    this.resendCountdown = 60;
    if (this.resendTimer) clearInterval(this.resendTimer);
    this.resendTimer = setInterval(() => {
      this.resendCountdown--;
      if (this.resendCountdown <= 0) { clearInterval(this.resendTimer); this.resendTimer = null; }
    }, 1000);
  }

  onCodeInput(e: any): void {
    const raw = onlyDigitsFn(e?.target?.value || '').slice(0, 6);
    e.target.value = raw;
    this.codeError = '';
    this.codeSuccess = '';
    if (raw.length === 6 && !this.codeVerified) this.verifyCode(raw);
  }

  // ------------------------------ Final submit (step 5) ------------------------------
  submit(): void {
    this.serverError = '';
    this.serverFieldErrors = {};
    this.loading = true;

    const b = this.formBasico.value;
    const e = this.formEndereco.value;
    const email = this.emailValue;
    const s = this.formSenha.value;
    const normalizedLogo = this.normalizeLogoForPayload(b.logo);

    if (b.logo && !normalizedLogo) {
      this.toast.info('Logo em arquivo sera ignorada neste cadastro inicial. Voce podera definir a logo apos aprovacao.');
    }

    const payload: any = {
      nome: b.nome?.trim(),
      tipo: b.tipo,
      email,
      telefone: onlyDigitsFn(b.telefone),
      cep: onlyDigitsFn(e.cep),
      endereco: e.endereco?.trim(),
      numero: e.numero?.trim() || undefined,
      complemento: e.complemento?.trim() || undefined,
      bairro: e.bairro?.trim() || undefined,
      cidade: e.cidade?.trim() || undefined,
      estado: e.estado ? String(e.estado).trim().toUpperCase() : undefined,
      descricao: b.descricao?.trim() || undefined,
      logo: normalizedLogo || undefined,
      cnpj: b.cnpj ? onlyDigitsFn(b.cnpj) : undefined,
      latitude: e.latitude ? Number(e.latitude) : undefined,
      longitude: e.longitude ? Number(e.longitude) : undefined,
      senha: s.senha,
      origem_mapa: this.claimSource || undefined,
      origem_place_id: this.claimPlaceId || undefined,
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
        this.toast.success('Cadastro enviado! Aguarde a aprovação do administrador.');
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

  irParaLogin(): void {
    this.router.navigateByUrl('/restrito/login');
  }

  // ------------------------------ Helpers ------------------------------
  get hasClaimContext(): boolean { return !!this.claimSource; }

  private applyPrefillFromQueryParams(): void {
    const queryMap = this.route.snapshot.queryParamMap;
    if (!queryMap.keys.length) return;

    const source = queryMap.get('source');
    const nome = this.readPrefillText(queryMap.get('nome'), 150);
    const telefone = this.readPrefillPhone(queryMap.get('telefone'));
    const endereco = this.readPrefillText(queryMap.get('endereco'), 180);
    const cidade = this.readPrefillText(queryMap.get('cidade'), 80);
    const estado = this.readPrefillState(queryMap.get('estado'));
    const latitude = this.readPrefillNumber(queryMap.get('latitude'), -90, 90);
    const longitude = this.readPrefillNumber(queryMap.get('longitude'), -180, 180);
    const suggestedType = this.resolveTypeFromQuery(
      queryMap.get('tipo'), queryMap.get('suggestedType'), queryMap.get('tipoPrimario')
    );

    this.claimSource = source === 'google' ? 'google' : null;
    this.claimPlaceId = this.readPrefillText(queryMap.get('placeId'), 128);

    this.formBasico?.patchValue({
      nome: nome ?? this.formBasico.get('nome')?.value ?? '',
      tipo: suggestedType ?? this.formBasico.get('tipo')?.value ?? '',
      telefone: telefone ?? this.formBasico.get('telefone')?.value ?? '',
    }, { emitEvent: false });

    this.formEndereco?.patchValue({
      endereco: endereco ?? this.formEndereco.get('endereco')?.value ?? '',
      cidade: cidade ?? this.formEndereco.get('cidade')?.value ?? '',
      estado: estado ?? this.formEndereco.get('estado')?.value ?? '',
      latitude: latitude != null ? String(latitude) : this.formEndereco.get('latitude')?.value ?? '',
      longitude: longitude != null ? String(longitude) : this.formEndereco.get('longitude')?.value ?? '',
    }, { emitEvent: false });
  }

  private resolveTypeFromQuery(...candidates: Array<string | null>): string | null {
    if (!this.types.length) return null;
    for (const candidate of candidates) {
      const normalized = String(candidate || '').trim().toLowerCase();
      if (!normalized) continue;
      const match = this.types.find((type: any) => {
        const id = String(type?.id ?? '').trim().toLowerCase();
        const nome = String(type?.nome ?? type?.label ?? '').trim().toLowerCase();
        const slug = nome.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        return normalized === id || normalized === nome || normalized === slug;
      });
      if (match) return String(match.id);
    }
    return null;
  }

  private readPrefillText(value: string | null, maxLen: number): string | null {
    const trimmed = String(value || '').trim();
    return trimmed ? trimmed.slice(0, maxLen) : null;
  }
  private readPrefillPhone(value: string | null): string | null {
    const digits = onlyDigitsFn(value).slice(0, 11);
    return digits ? this.formatTelefone(digits) : null;
  }
  private readPrefillState(value: string | null): string | null {
    const trimmed = String(value || '').trim().toUpperCase();
    return trimmed ? trimmed.slice(0, 2) : null;
  }
  private readPrefillNumber(value: string | null, min: number, max: number): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.min(max, Math.max(min, parsed));
  }

  // ------------------------------ Error helpers ------------------------------
  hasErrorBasico(name: string, err?: string): boolean {
    const c = this.formBasico.get(name);
    if (!c || (!c.touched && !this.submittedBasico)) return false;
    return err ? !!c.hasError(err) : c.invalid;
  }
  hasErrorEndereco(name: string, err?: string): boolean {
    const c = this.formEndereco.get(name);
    if (!c || (!c.touched && !this.submittedEndereco)) return false;
    return err ? !!c.hasError(err) : c.invalid;
  }
  hasErrorEmail(name: string, err?: string): boolean {
    const c = this.formEmail.get(name);
    if (!c || (!c.touched && !this.submittedEmail)) return false;
    return err ? !!c.hasError(err) : c.invalid;
  }
  hasErrorSenha(name: string, err?: string): boolean {
    const c = this.formSenha.get(name);
    if (!c || (!c.touched && !this.submittedSenha)) return false;
    return err ? !!c.hasError(err) : c.invalid;
  }
  get passwordMismatch(): boolean {
    return !!(this.formSenha.errors?.['passwordMismatch']
      && (this.formSenha.get('confirmSenha')?.touched || this.submittedSenha));
  }

  // ------------------------------ Máscaras ------------------------------
  private onlyDigits(v: string) { return onlyDigitsFn(v); }

  private normalizeLogoForPayload(value: any): string | null {
    const raw = String(value || '').trim();
    if (!raw) return null;
    // Backend field parceiros.logo_url is VARCHAR(255); base64 payloads break insertion.
    if (raw.startsWith('data:')) return null;
    if (raw.length > 255) return null;
    return raw;
  }

  formatCep(v: string) {
    const d = this.onlyDigits(v).slice(0, 8);
    if (!d) return '';
    return d.length <= 5 ? d : d.slice(0, 5) + '-' + d.slice(5);
  }
  onCepInput(e: any) {
    const digits = this.onlyDigits(e?.target?.value || '').slice(0, 8);
    this.formEndereco.get('cep')?.setValue(this.formatCep(digits), { emitEvent: false });
    if (digits.length === 8) this.lookupCep(digits);
  }

  lookupCep(cepDigits: string) {
    this.api.buscarCepViaCep(cepDigits).subscribe({
      next: (res: any) => {
        if (!res || res.erro) { this.toast.error('CEP não encontrado.'); return; }
        const enderecoText = `${res.logradouro || ''}`.trim();
        if (enderecoText) this.formEndereco.get('endereco')?.setValue(enderecoText);
        if (res.bairro) this.formEndereco.get('bairro')?.setValue(res.bairro);
        if (res.localidade) this.formEndereco.get('cidade')?.setValue(res.localidade);
        if (res.uf) this.formEndereco.get('estado')?.setValue(res.uf);

        const fullAddress = `${res.logradouro || ''} ${res.bairro || ''} ${res.localidade || ''} ${res.uf || ''} Brasil`.trim();
        if (fullAddress.replace(/\s/g, '') !== '') {
          this.api.geocodeAddress(fullAddress).subscribe({
            next: (geo: any[]) => {
              if (geo && geo.length > 0) {
                this.formEndereco.get('latitude')?.setValue(geo[0].lat);
                this.formEndereco.get('longitude')?.setValue(geo[0].lon);
              }
            },
            error: () => {}
          });
        }
      },
      error: () => { this.toast.error('Erro ao consultar CEP.'); }
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
    this.formBasico.get('telefone')?.setValue(masked, { emitEvent: false });
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
    this.formBasico.get('cnpj')?.setValue(masked, { emitEvent: false });
  }

  onLogoSelected(e: any) {
    const file: File = e?.target?.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith('image/')) { this.toast.error('Formato inválido. Envie uma imagem.'); return; }
    if (file.size > 2 * 1024 * 1024) { this.toast.error('Imagem muito grande. Máx 2MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      this.logoPreview = dataUrl;
      this.logoFileName = file.name;
      this.formBasico.get('logo')?.setValue(dataUrl);
    };
    reader.readAsDataURL(file);
  }
}
