import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApiService } from '../../../../services/admin-api.service';
import { ToastService } from '../../../../services/toast.service';
import { MARCA_NOME } from '../../../../constants/loja-public';

@Component({
  selector: 'app-admin-test-email',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-test-email.component.html',
  styleUrls: ['./admin-test-email.component.scss'],
})
export class AdminTestEmailComponent {
  sending = false;
  lastResult: { ok: boolean; envio_id?: number; id_provedor?: string; requestId?: string | null; error?: string } | null =
    null;

  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private api: AdminApiService,
    private toast: ToastService
  ) {
    this.form = this.fb.group({
      para: ['', [Validators.required, Validators.email]],
      assunto: [`Teste ${MARCA_NOME} (Resend)`, [Validators.required, Validators.maxLength(998)]],
      texto: ['Este é um e-mail de teste enviado pelo painel administrativo.', [Validators.required]],
    });
  }

  submit() {
    if (this.form.invalid || this.sending) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.sending = true;
    this.lastResult = null;
    this.api.sendTestEmail({ para: v.para!.trim(), assunto: v.assunto!.trim(), texto: v.texto! }).subscribe({
      next: (res) => {
        this.sending = false;
        this.lastResult = { ok: true, envio_id: res.envio_id, id_provedor: res.id_provedor, requestId: res.requestId };
        this.toast.success('E-mail enviado. Confira a caixa de entrada e as tabelas email_* no banco.');
      },
      error: (err) => {
        this.sending = false;
        const msg = err?.error?.error || err?.message || 'Falha ao enviar.';
        this.lastResult = { ok: false, error: msg, requestId: err?.error?.requestId };
        this.toast.error(msg);
      },
    });
  }
}
