import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NavmenuComponent } from '../../navmenu/navmenu.component';
import { ApiService, ClienteMeResponse } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NavmenuComponent, NgxMaskDirective],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.scss'],
  providers: [provideNgxMask()]
})
export class PerfilComponent {
  me: ClienteMeResponse | null = null;
  carregando = true;
  salvando = false;

  // dados do usuário
  nome = '';
  email = '';
  telefone = '';
  telefoneSecundario = '';
  cpf = '';
  rg = '';
  dataNascimento = ''; // ISO yyyy-MM-dd
  genero: 'Masculino' | 'Feminino' | 'Outro' | 'Prefiro não dizer' | '' = '';
  estadoCivil: 'Solteiro(a)' | 'Casado(a)' | 'Divorciado(a)' | 'Viúvo(a)' | '' = '';
  profissao = '';

  // endereço (mock de campos comuns)
  endereco = {
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    referencia: '',
    tipo: '' // residencial, comercial, etc
  };

  cepCarregando = false;

  // preferências
  prefEmail = true;
  prefWhats = false;
  prefMarketing = false;
  prefNotificarPedidos = true;
  prefNotificarReceitas = true;
  prefLembrarVacinas = false;
  prefLembrarConsultas = false;
  contatoPreferido: 'email' | 'whatsapp' | 'telefone' | '' = '';
  horarioPreferido: 'manhã' | 'tarde' | 'noite' | '' = '';

  // Observações gerais
  observacoes = '';

  // validação simples
  emailValido = true;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ){}

  private get token(): string | null {
    return isPlatformBrowser(this.platformId) ? this.auth.getToken() : null;
  }

  ngOnInit(){
    const t = this.token;
    if (!t) { this.carregando = false; return; }
    this.api.getClienteMe(t).subscribe({
      next: (me) => {
        this.me = me;
        const u: any = me?.user || {};
        this.nome = u.nome || '';
        this.email = u.email || '';
        this.telefone = u.telefone || '';
        this.telefoneSecundario = u.telefone2 || u.telefoneSecundario || '';
        this.cpf = u.cpf || '';
        this.rg = u.rg || '';
        // aceitar 'nascimento' ou 'dataNascimento'
        this.dataNascimento = (u.dataNascimento || u.nascimento || '').slice(0,10) || '';
        this.genero = u.genero || '';
        this.estadoCivil = u.estadoCivil || '';
        this.profissao = u.profissao || '';
        // endereço: aceita tanto user.endereco quanto me.endereco (top-level)
        if (u.endereco) {
          const e = u.endereco;
          this.endereco = { ...this.endereco, ...e };
          if ((e as any).uf && !this.endereco.estado) this.endereco.estado = (e as any).uf;
        } else if ((me as any)?.endereco) {
          const e = (me as any).endereco;
          this.endereco = { ...this.endereco, ...e };
          if ((e as any).uf && !this.endereco.estado) this.endereco.estado = (e as any).uf;
        }
        // preferencias (fallbacks)
        const prefs = u.preferencias || {};
        this.prefEmail = prefs.email ?? true;
        this.prefWhats = prefs.whatsapp ?? false;
        this.prefMarketing = prefs.marketing ?? false;
        this.prefNotificarPedidos = prefs.notificarPedidos ?? true;
        this.prefNotificarReceitas = prefs.notificarReceitas ?? true;
        this.prefLembrarVacinas = prefs.lembretesVacinas ?? false;
        this.prefLembrarConsultas = prefs.lembretesConsultas ?? false;
        this.contatoPreferido = prefs.contatoPreferido || '';
        this.horarioPreferido = prefs.horarioPreferido || '';

        this.observacoes = u.observacoes || '';
        this.carregando = false;
      },
      error: () => { this.carregando = false; }
    });
  }

  salvar(){
    if (!this.token || !this.me?.user?.id) return;
    if (!this.nome || !this.email) { this.toast.info('Preencha nome e email'); return; }
    this.emailValido = /.+@.+\..+/.test(this.email);
    if (!this.emailValido) { this.toast.info('Email inválido'); return; }
    this.salvando = true;
    const digits = (v: string) => (v||'').replace(/\D/g, '');
    const end = this.endereco || ({} as any);
    const enderecoPayload = this.endereco ? {
      cep: digits(end.cep || ''),
      logradouro: (end.logradouro||'').trim(),
      numero: (end.numero||'').trim(),
      complemento: (end.complemento||'').trim(),
      bairro: (end.bairro||'').trim(),
      cidade: (end.cidade||'').trim(),
  estado: (((end as any).estado || (end as any).uf || '') + '').toUpperCase().slice(0,2),
      referencia: (end.referencia||'').trim() || undefined,
      tipo: (end.tipo||'').trim() || undefined
    } : undefined;
    const payload = {
      nome: this.nome.trim(),
      email: this.email.trim(),
      telefone: digits(this.telefone),
      telefone2: digits(this.telefoneSecundario) || undefined,
      rg: (this.rg||'').trim(),
      genero: this.genero || undefined,
      estadoCivil: this.estadoCivil || undefined,
      profissao: this.profissao || undefined,
      dataNascimento: this.dataNascimento || undefined,
      endereco: enderecoPayload,
      preferencias: {
        email: !!this.prefEmail,
        whatsapp: !!this.prefWhats,
        marketing: !!this.prefMarketing,
        notificarPedidos: !!this.prefNotificarPedidos,
        notificarReceitas: !!this.prefNotificarReceitas,
        lembretesVacinas: !!this.prefLembrarVacinas,
        lembretesConsultas: !!this.prefLembrarConsultas,
        contatoPreferido: this.contatoPreferido || undefined,
        horarioPreferido: this.horarioPreferido || undefined
      },
      observacoes: this.observacoes || undefined
    };
    this.api.updateCliente(this.me.user.id, payload, this.token).subscribe({
      next: () => this.toast.success('Perfil atualizado!'),
      error: (err: any) => {
        const msg = err?.error?.message || err?.message || 'Erro ao salvar perfil';
        this.toast.error(msg, 'Erro');
      },
      complete: () => this.salvando = false
    });
  }

  onCepInput(){
    const digits = (this.endereco.cep || '').replace(/\D/g, '');
    if (digits.length === 8) {
      this.buscarCep(digits);
    }
  }

  buscarCep(cepDigits: string){
    if (!cepDigits || cepDigits.length !== 8) return;
    this.cepCarregando = true;
    this.http.get<any>(`https://viacep.com.br/ws/${cepDigits}/json/`).subscribe({
      next: (res) => {
        if (res && !res.erro) {
          this.endereco.logradouro = res.logradouro || this.endereco.logradouro;
          this.endereco.bairro = res.bairro || this.endereco.bairro;
          this.endereco.cidade = res.localidade || this.endereco.cidade;
          this.endereco.estado = res.uf || this.endereco.estado;
          this.endereco.complemento = res.complemento || this.endereco.complemento;
        } else {
          this.toast.info('CEP não encontrado');
        }
      },
      error: () => this.toast.error('Erro ao consultar CEP'),
      complete: () => this.cepCarregando = false
    });
  }

  onUfInput(){
    this.endereco.estado = (this.endereco.estado || '').toUpperCase().slice(0,2);
  }
}
