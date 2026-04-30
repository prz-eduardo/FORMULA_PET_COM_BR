import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-parceiro-minha-loja',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './parceiro-minha-loja.component.html',
  styleUrls: ['./parceiro-minha-loja.component.scss'],
})
export class ParceiroMinhaLojaComponent implements OnInit {
  private readonly base = environment.apiBaseUrl;
  loading = signal(false);
  saving = signal(false);
  vitrine = signal<any | null>(null);
  vitrineProdutos = signal<any[]>([]);
  novoProdutoId = signal('');

  readonly form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    public auth: ParceiroAuthService,
    private toast: ToastService
  ) {
    this.form = this.fb.group({
      loja_slug: [''],
      texto_institucional: [''],
      mercadopago_access_token: [''],
    });
  }

  ngOnInit(): void {
    void this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const [loja, prods] = await Promise.all([
        firstValueFrom(this.http.get<any>(`${this.base}/parceiro/vitrine/loja`, { headers: this.auth.getAuthHeaders() })),
        firstValueFrom(this.http.get<any>(`${this.base}/parceiro/vitrine/produtos`, { headers: this.auth.getAuthHeaders() })),
      ]);
      this.vitrine.set(loja);
      this.vitrineProdutos.set(prods?.data || []);
      this.form.patchValue({
        loja_slug: loja?.loja_slug || '',
        texto_institucional: loja?.texto_institucional || '',
        mercadopago_access_token: '',
      });
    } catch {
      this.toast.error('Não foi possível carregar os dados da vitrine.');
    } finally {
      this.loading.set(false);
    }
  }

  async salvarLoja(): Promise<void> {
    if (!this.auth.isMaster()) {
      this.toast.error('Apenas o usuário master pode alterar a vitrine.');
      return;
    }
    this.saving.set(true);
    try {
      const body: any = {
        loja_slug: (this.form.value.loja_slug || '').trim() || null,
        texto_institucional: this.form.value.texto_institucional ?? null,
      };
      const mpCtrl = this.form.get('mercadopago_access_token');
      if (mpCtrl?.dirty) {
        body.mercadopago_access_token = (this.form.value.mercadopago_access_token || '').trim();
      }
      const res = await firstValueFrom(
        this.http.patch<any>(`${this.base}/parceiro/vitrine/loja`, body, { headers: this.auth.getAuthHeaders() })
      );
      this.toast.success('Loja atualizada.');
      this.vitrine.set({ ...this.vitrine(), ...res });
      this.form.patchValue({ mercadopago_access_token: '' });
    } catch (e: any) {
      const msg = e?.error?.error || 'Erro ao salvar.';
      this.toast.error(msg);
    } finally {
      this.saving.set(false);
    }
  }

  async adicionarProduto(): Promise<void> {
    if (!this.auth.isMaster()) return;
    const id = Number(this.novoProdutoId().replace(/\D/g, ''));
    if (!id) {
      this.toast.error('Informe o ID do produto do marketplace.');
      return;
    }
    try {
      await firstValueFrom(
        this.http.post(`${this.base}/parceiro/vitrine/produtos`, { produto_id: id }, { headers: this.auth.getAuthHeaders() })
      );
      this.novoProdutoId.set('');
      this.toast.success('Produto adicionado à vitrine.');
      await this.reload();
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'Não foi possível adicionar o produto.');
    }
  }

  async removerProduto(produtoId: number): Promise<void> {
    if (!this.auth.isMaster()) return;
    try {
      await firstValueFrom(
        this.http.delete(`${this.base}/parceiro/vitrine/produtos/${produtoId}`, { headers: this.auth.getAuthHeaders() })
      );
      this.toast.success('Removido da vitrine.');
      await this.reload();
    } catch {
      this.toast.error('Erro ao remover.');
    }
  }
}
