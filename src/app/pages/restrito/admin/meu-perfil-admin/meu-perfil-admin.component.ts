import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { SessionService } from '../../../../services/session.service';
import { ToastService } from '../../../../services/toast.service';

interface AdminRow {
  id: number;
  nome: string;
  email: string;
  ativo: number | boolean;
  is_super: number | boolean;
}

const passwordMatchValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const a = group.get('senha')?.value;
  const b = group.get('confirma')?.value;
  if (!a || !b) return null;
  return a === b ? null : { passwordMismatch: true };
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
  selector: 'app-meu-perfil-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './meu-perfil-admin.component.html',
  styleUrls: ['./meu-perfil-admin.component.scss']
})
export class MeuPerfilAdminComponent implements OnInit {
  user: any = null;
  isSuper = false;

  minhaSenhaForm: FormGroup;
  outroAdminForm: FormGroup;

  admins: AdminRow[] = [];
  loadingAdmins = false;
  savingMinha = false;
  savingOutro = false;

  showP1 = false;
  showP2 = false;
  showQ1 = false;
  showQ2 = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private session: SessionService,
    private toast: ToastService,
    private router: Router
  ) {
    this.minhaSenhaForm = this.fb.group(
      {
        senha: ['', [Validators.required, strongPasswordValidator]],
        confirma: ['', [Validators.required]],
      },
      { validators: [passwordMatchValidator] }
    );

    this.outroAdminForm = this.fb.group(
      {
        admin_id: ['', [Validators.required]],
        senha: ['', [Validators.required, strongPasswordValidator]],
        confirma: ['', [Validators.required]],
      },
      { validators: [passwordMatchValidator] }
    );
  }

  ngOnInit(): void {
    this.user = this.session.getUser() || this.session.decodeToken() || null;
    this.isSuper = this.session.isSuper();
    if (this.isSuper) this.loadAdmins();
  }

  voltar() { this.router.navigate(['/restrito/admin']); }

  private authHeaders(): Record<string, string> {
    const t = this.session.getBackendToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  // ------------------------------ Helpers UI ------------------------------
  hasErr(form: FormGroup, name: string, err?: string): boolean {
    const c = form.get(name);
    if (!c || !c.touched) return false;
    if (err) return !!c.hasError(err);
    return c.invalid;
  }
  hasMismatch(form: FormGroup): boolean {
    return !!form.errors?.['passwordMismatch'] && !!form.get('confirma')?.touched;
  }

  // ------------------------------ Admins list (super only) -----------------
  loadAdmins() {
    this.loadingAdmins = true;
    const api = this.session.getBackendBaseUrl();
    this.http
      .get<{ data: AdminRow[] }>(`${api}/admin/admins`, { headers: this.authHeaders() })
      .subscribe({
        next: (res) => {
          this.admins = (res?.data || []).filter((a) => a.id !== (this.user?.id || 0));
          this.loadingAdmins = false;
        },
        error: (err) => {
          this.loadingAdmins = false;
          const msg = err?.error?.error || err?.error?.message || 'Não foi possível carregar a lista de admins.';
          this.toast.error(msg);
        }
      });
  }

  // ------------------------------ Trocar MINHA senha -----------------------
  salvarMinhaSenha() {
    if (!this.user?.id) {
      this.toast.error('Usuário não identificado na sessão.');
      return;
    }
    if (this.minhaSenhaForm.invalid) {
      this.minhaSenhaForm.markAllAsTouched();
      return;
    }

    // Apenas super-admin pode chamar /auth/admin/set-password.
    // Admin comum ainda pode alterar a PRÓPRIA senha via o mesmo endpoint
    // se o backend permitir — no momento o endpoint é restrito a super,
    // portanto admins normais devem pedir a um super.
    if (!this.isSuper) {
      this.toast.error('Somente um super-admin pode alterar senhas. Peça a um super-admin.');
      return;
    }

    this.savingMinha = true;
    const api = this.session.getBackendBaseUrl();
    const body = { admin_id: this.user.id, senha: this.minhaSenhaForm.value.senha };

    this.http.post<any>(`${api}/auth/admin/set-password`, body, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.savingMinha = false;
        this.minhaSenhaForm.reset();
        this.toast.success('Senha atualizada com sucesso!');
      },
      error: (err) => {
        this.savingMinha = false;
        const msg = err?.error?.error || err?.error?.message || 'Falha ao atualizar a senha.';
        this.toast.error(msg);
      }
    });
  }

  // ------------------------------ Trocar senha de OUTRO admin --------------
  salvarSenhaOutro() {
    if (!this.isSuper) {
      this.toast.error('Apenas super-admins podem alterar senhas de outros admins.');
      return;
    }
    if (this.outroAdminForm.invalid) {
      this.outroAdminForm.markAllAsTouched();
      return;
    }

    this.savingOutro = true;
    const api = this.session.getBackendBaseUrl();
    const body = {
      admin_id: Number(this.outroAdminForm.value.admin_id),
      senha: this.outroAdminForm.value.senha
    };

    this.http.post<any>(`${api}/auth/admin/set-password`, body, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.savingOutro = false;
        this.outroAdminForm.reset();
        this.toast.success('Senha do admin atualizada com sucesso!');
      },
      error: (err) => {
        this.savingOutro = false;
        const msg = err?.error?.error || err?.error?.message || 'Falha ao atualizar a senha.';
        this.toast.error(msg);
      }
    });
  }
}
