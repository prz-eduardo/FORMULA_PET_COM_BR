import { Component, Inject, PLATFORM_ID, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
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
  @Input() modal: boolean = false;
  @Input() readOnly: boolean = true;
  @Output() close = new EventEmitter<void>();
  @Output() navigate = new EventEmitter<string>();
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
  // avatar preview when selecting a new image locally
  avatarPreview: string | null = null;
  private _avatarObjectUrl: string | null = null;

  // Avatar edit flow state
  avatarOptionsVisible = false; // show Excluir / Trocar actions
  avatarPendingFile: File | null = null; // file chosen but not yet saved
  avatarOriginalUrl?: string | null = null; // to restore on cancel
  avatarChanged = false; // whether there's a pending change to save

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ){}

  deletingAccount = false;

  logout(): void {
    try { this.auth.logout(); } catch {}
    // if inside modal, close; otherwise navigate to home
    try { if (this.modal) this.close.emit(); } catch {}
    try { const r = (window as any).location; r.href = '/'; } catch {}
  }

  confirmDeleteAccount(): void {
    if (!this.me?.user?.id) { this.toast.error('Usuário inválido'); return; }
    const ok = confirm('Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita.');
    if (!ok) return;
    this.deleteAccount();
  }

  deleteAccount(): void {
    if (!this.token || !this.me?.user?.id) { this.toast.error('Não autenticado'); return; }
    this.deletingAccount = true;
    this.api.deleteCliente(this.me.user.id, this.token).subscribe({
      next: () => {
        this.toast.success('Conta excluída');
        try { this.auth.logout(); } catch {}
        try { if (this.modal) this.close.emit(); } catch {}
        try { (window as any).location.href = '/'; } catch {}
      },
      error: (err: any) => {
        const m = err?.error?.message || err?.message || 'Erro ao excluir conta';
        this.toast.error(m, 'Erro');
      },
      complete: () => { this.deletingAccount = false; }
    });
  }


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

  onAvatarSelected(ev: Event) {
    try {
      const input = ev.target as HTMLInputElement;
      if (!input.files || input.files.length === 0) return;
      const file = input.files[0];
      // keep original so cancel can restore it
  const _u: any = (this.me && (this.me as any).user) || {};
  if (!this.avatarOriginalUrl) this.avatarOriginalUrl = _u.photoURL || null;
      if (this._avatarObjectUrl) {
        URL.revokeObjectURL(this._avatarObjectUrl);
        this._avatarObjectUrl = null;
      }
      this._avatarObjectUrl = URL.createObjectURL(file);
      this.avatarPreview = this._avatarObjectUrl;
      this.avatarPendingFile = file;
      this.avatarChanged = true;
      // when a file is chosen, show Save/Cancel (hide basic options)
      this.avatarOptionsVisible = false;
      // Note: actual upload/save should be handled in saveAvatarChange() or a dedicated endpoint.
    } catch (e) {
      console.error('Erro ao selecionar avatar', e);
    }
  }

  toggleAvatarOptions() {
    this.avatarOptionsVisible = !this.avatarOptionsVisible;
  }

  chooseChangeAvatar() {
    // programmatically open file input
    const el = document.getElementById('perfil-avatar-file') as HTMLInputElement | null;
    if (el) el.click();
  }

  confirmRemoveAvatar() {
    // mark as changed and clear preview (user intends to remove)
  const _u2: any = (this.me && (this.me as any).user) || {};
  if (!this.avatarOriginalUrl) this.avatarOriginalUrl = _u2.photoURL || null;
    if (this.avatarPreview) {
      if (this._avatarObjectUrl) {
        URL.revokeObjectURL(this._avatarObjectUrl);
        this._avatarObjectUrl = null;
      }
      this.avatarPreview = null;
    }
    this.avatarPendingFile = null;
    this.avatarChanged = true;
    this.avatarOptionsVisible = false;
  }

  cancelAvatarChange() {
    // revoke pending preview and restore original
    if (this._avatarObjectUrl) {
      URL.revokeObjectURL(this._avatarObjectUrl);
      this._avatarObjectUrl = null;
    }
    this.avatarPendingFile = null;
    this.avatarChanged = false;
    // restore original (if any)
    if (this.avatarOriginalUrl) {
      this.avatarPreview = this.avatarOriginalUrl;
      this.avatarOriginalUrl = undefined;
    }
  }

  saveAvatarChange() {
    // integrate with existing salvar/update flow. Here we'll call updateCliente with a FormData if there's a file,
    // or send a null/empty photoURL to remove the avatar.
    if (!this.me || !this.me.user) return;
    if (this.avatarPendingFile) {
      const fd = new FormData();
      fd.append('photo', this.avatarPendingFile);
      // If your API supports multipart upload for photo, call it here. We'll assume updateCliente accepts multipart.
      this.api.updateCliente(this.me.user.id, fd as any, this.token as string).subscribe({
        next: (res: any) => {
          this.toast.show('Foto atualizada');
          // clear pending state and refresh local user photo
          (this.me!.user as any).photoURL = res?.photoURL || this.avatarPreview || (this.me!.user as any).photoURL;
          this.avatarPendingFile = null;
          this.avatarChanged = false;
          this.avatarOriginalUrl = undefined;
        },
        error: (err: any) => {
          this.toast.show('Erro ao enviar foto');
        }
      });
    } else if (this.avatarChanged && !this.avatarPendingFile) {
      // user chose to remove avatar
      const payload = { photoURL: null } as any;
      this.api.updateCliente(this.me.user.id, payload, this.token as string).subscribe({
        next: (res: any) => {
          this.toast.show('Foto removida');
          (this.me!.user as any).photoURL = null;
          this.avatarChanged = false;
          this.avatarOriginalUrl = undefined;
        },
        error: (err: any) => this.toast.show('Erro ao remover foto')
      });
    }
  }

  avatarSrc(): string {
    if (this.avatarPreview) return this.avatarPreview;
    try {
      const u: any = (this.me && (this.me as any).user) || {};
      return u.photoURL || '/imagens/image.png';
    } catch { return '/imagens/image.png'; }
  }

  // Which section is currently being edited (null = none). Sections: 'informacoes','endereco','preferencias','observacoes'
  // backups for canceling edits per-section
  private sectionBackup: any = {};

  editingSection: string | null = null;

  editSection(section: string|null){
    if (!section) { this.editingSection = null; this.readOnly = true; return; }
    // create backup snapshot for the section so cancel can restore
    switch(section){
      case 'informacoes':
        this.sectionBackup.informacoes = {
          nome: this.nome,
          email: this.email,
          telefone: this.telefone,
          telefoneSecundario: this.telefoneSecundario,
          cpf: this.cpf,
          rg: this.rg,
          dataNascimento: this.dataNascimento,
          genero: this.genero,
          estadoCivil: this.estadoCivil,
          profissao: this.profissao
        };
        break;
      case 'endereco':
        this.sectionBackup.endereco = JSON.parse(JSON.stringify(this.endereco || {}));
        break;
      case 'preferencias':
        this.sectionBackup.preferencias = {
          contatoPreferido: this.contatoPreferido,
          horarioPreferido: this.horarioPreferido,
          prefEmail: this.prefEmail,
          prefWhats: this.prefWhats,
          prefMarketing: this.prefMarketing,
          prefNotificarPedidos: this.prefNotificarPedidos,
          prefNotificarReceitas: this.prefNotificarReceitas,
          prefLembrarVacinas: this.prefLembrarVacinas,
          prefLembrarConsultas: this.prefLembrarConsultas
        };
        break;
      case 'observacoes':
        this.sectionBackup.observacoes = this.observacoes;
        break;
    }
    // enable overall edit mode when any section enters edit
    this.editingSection = section;
    this.readOnly = false;
    // scroll to top of modal to show form (if in modal)
    try { window.setTimeout(()=>{ const el = document.querySelector('.perfil-wrapper'); if (el) (el as any).scrollTop = 0; },50); } catch {}
  }

  cancelEditSection(){
    const s = this.editingSection;
    if (!s) return;
    // restore from backup
    switch(s){
      case 'informacoes':
        if (this.sectionBackup.informacoes) {
          const b = this.sectionBackup.informacoes;
          this.nome = b.nome; this.email = b.email; this.telefone = b.telefone; this.telefoneSecundario = b.telefoneSecundario;
          this.cpf = b.cpf; this.rg = b.rg; this.dataNascimento = b.dataNascimento; this.genero = b.genero; this.estadoCivil = b.estadoCivil; this.profissao = b.profissao;
        }
        break;
      case 'endereco':
        if (this.sectionBackup.endereco) {
          this.endereco = JSON.parse(JSON.stringify(this.sectionBackup.endereco));
        }
        break;
      case 'preferencias':
        if (this.sectionBackup.preferencias) {
          const b = this.sectionBackup.preferencias;
          this.contatoPreferido = b.contatoPreferido; this.horarioPreferido = b.horarioPreferido;
          this.prefEmail = b.prefEmail; this.prefWhats = b.prefWhats; this.prefMarketing = b.prefMarketing;
          this.prefNotificarPedidos = b.prefNotificarPedidos; this.prefNotificarReceitas = b.prefNotificarReceitas;
          this.prefLembrarVacinas = b.prefLembrarVacinas; this.prefLembrarConsultas = b.prefLembrarConsultas;
        }
        break;
      case 'observacoes':
        if (this.sectionBackup.observacoes !== undefined) this.observacoes = this.sectionBackup.observacoes;
        break;
    }
    // clear editing state
    this.editingSection = null;
    this.readOnly = true;
  }

  saveSection(){
    if (!this.token || !this.me?.user?.id) return;
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
    const payload: any = {
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
      next: () => {
        this.toast.success('Perfil atualizado!');
        // clear backup for this section
        if (this.editingSection) delete this.sectionBackup[this.editingSection];
      },
      error: (err: any) => {
        const msg = err?.error?.message || err?.message || 'Erro ao salvar perfil';
        this.toast.error(msg, 'Erro');
      },
      complete: () => {
        this.salvando = false;
        this.editingSection = null;
        this.readOnly = true;
      }
    });
  }

  // When a specific section is being edited, we still want to display the other sections
  // in read-only mode. This helper returns true when the named section should be shown
  // in the read-only column. If we're not editing any section (editingSection === null),
  // all sections show normally.
  isSectionReadOnlyVisible(section: string) {
    if (this.editingSection === null) return true;
    // always show the section that's being edited as well (to keep context) but its form
    // will be shown in edit mode elsewhere
    return true;
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

  fechar(){ if (this.modal) this.close.emit(); }
}
