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
  constructor(
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router
 ){}
  /**
   * Retorna true se a rota atual for uma das que devem ocultar o campo profissão
   */
  isPerfilHiddenOnRoute(): boolean {
    if (!this.router || !this.router.url) return false;
    const url = this.router.url;
    return (
      url.includes('/mapa') ||
      url.includes('/galeria') ||
      url.includes('/loja') ||
      url.includes('/carrinho')
    );
  }
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


  deletingAccount = false;

  logout(): void {
    try { this.auth.logout(); } catch {}
    // if inside modal, close; otherwise navigate to home
    try { if (this.modal) this.close.emit(); } catch {}
    try { const r = (window as any).location; r.href = '/'; } catch {}
  }

  confirmDeleteAccount(): void {
    // Deprecated: previous confirm flow replaced by modal with LGPD notice.
    this.openDeleteAccountModal();
  }

  // Modal state for delete confirmation with LGPD acknowledgement
  deleteModalOpen = false;
  lgpdChecked = false;
  // Privacy policy modal state
  privacyModalOpen = false;

  openDeleteAccountModal(): void {
    if (!this.me?.user?.id) { this.toast.error('Usuário inválido'); return; }
    this.lgpdChecked = false;
    // If this component is embedded inside another modal, create a global overlay appended to body
    if (this.modal) {
      this.showGlobalDeleteModal();
      return;
    }
    this.deleteModalOpen = true;
    try { window.setTimeout(()=>{ const el = document.querySelector('.modal-content'); if (el) (el as any).scrollTop = 0; },50); } catch {}
  }

  closeDeleteAccountModal(): void {
    this.deleteModalOpen = false;
    this.lgpdChecked = false;
    this.removeGlobalOverlay('global-delete-modal');
  }

  openPrivacyModal(): void {
    if (this.modal) {
      this.showGlobalPrivacyModal();
      return;
    }
    this.privacyModalOpen = true;
    try { window.setTimeout(()=>{ const el = document.querySelector('.modal-content.privacy'); if (el) (el as any).scrollTop = 0; },50); } catch {}
  }

  closePrivacyModal(): void {
    this.privacyModalOpen = false;
  }

  // User clicked 'Concordo' inside the privacy modal
  agreePrivacy(): void {
    this.lgpdChecked = true;
    this.privacyModalOpen = false;
    // focus back to delete modal if open
    try { window.setTimeout(()=>{ const el = document.querySelector('.modal-content'); if (el) (el as any).focus(); },50); } catch {}
  }

  // --- Helpers to render a simple global overlay appended to body when this component is embedded in another modal ---
  private removeGlobalOverlay(id: string) {
    try {
      const existing = document.getElementById(id);
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    } catch (e) { /* ignore */ }
  }

  private showGlobalDeleteModal() {
    this.removeGlobalOverlay('global-delete-modal');
    const container = document.createElement('div');
    container.id = 'global-delete-modal';
    container.className = 'modal-overlay global';
  container.style.position = 'fixed';
  container.style.left = '0'; container.style.top = '0'; container.style.width = '100%'; container.style.height = '100%';
  container.style.display = 'flex'; container.style.alignItems = 'center'; container.style.justifyContent = 'center';
  container.style.zIndex = '99999';
  // backdrop to visually separate modal from underlying content
  container.style.background = 'rgba(6,10,14,0.64)';
  (container.style as any).backdropFilter = 'blur(6px) saturate(120%)';
  (container.style as any).webkitBackdropFilter = 'blur(6px) saturate(120%)';
  // no padding on overlay container — modal-content controls its own padding
    container.innerHTML = `
      <div class="modal-content card" role="dialog" aria-modal="true" style="max-width:720px; width:92%;">
        <header class="modal-header"><h3>Desativar conta</h3></header>
        <div class="modal-body" style="max-height:60vh; overflow:auto;">
          <p>Ao desativar sua conta, ela será imediatamente desativada. Se não for reativada dentro de 30 dias, você perderá o acesso permanentemente e seus dados poderão ser excluídos conforme nossa política de retenção.</p>
          <p><strong>O que acontece ao desativar:</strong></p>
          <ul>
            <li>A conta ficará desativada por até 30 dias, período no qual você pode reativá-la.</li>
            <li>Se não reativada em 30 dias, o acesso será perdido e os dados poderão ser removidos ou anonimizados.</li>
            <li>Algumas informações poderão ser retidas por obrigações legais (ex.: fiscais) mesmo após exclusão.</li>
          </ul>
          <p>Em conformidade com a LGPD, leia nossa <a href="#" id="global-privacy-link">Política de Privacidade</a> antes de confirmar.</p>
          <p style="margin-top:8px;">Para habilitar a desativação você precisa ler a Política de Privacidade e clicar em <strong>Concordo</strong>.</p>
          <label style="display:flex; align-items:center; gap:8px; margin-top:12px;">
            <input type="checkbox" id="global-lgpd-checkbox" disabled />
            Li e concordo com a Política de Privacidade (LGPD).
          </label>
        </div>
        <div class="modal-actions" style="display:flex; gap:8px; justify-content:flex-end; padding-top:12px;">
          <button class="btn btn-sec" id="global-delete-cancel">Cancelar</button>
          <button class="btn danger" id="global-delete-confirm" disabled>Desativar conta</button>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    // ensure overlay doesn't allow horizontal overflow and supports vertical scroll
    container.style.overflowX = 'hidden';
    container.style.overflowY = 'auto';

    // ensure modal-content is centered and uses border-box to avoid width leakage
    try {
      const mc = container.querySelector('.modal-content') as HTMLElement | null;
      if (mc) { mc.style.margin = '0 auto'; mc.style.boxSizing = 'border-box'; mc.style.maxWidth = mc.style.maxWidth || '760px'; }
    } catch (e) {}

    // wire events
    const btnCancel = container.querySelector('#global-delete-cancel') as HTMLButtonElement | null;
    const btnConfirm = container.querySelector('#global-delete-confirm') as HTMLButtonElement | null;
    const privacyLink = container.querySelector('#global-privacy-link') as HTMLAnchorElement | null;
    const lgpdCheckbox = container.querySelector('#global-lgpd-checkbox') as HTMLInputElement | null;

    const onClose = () => { this.removeGlobalOverlay('global-delete-modal'); };
    const onPrivacyOpen = (e?: Event) => { e && e.preventDefault(); this.showGlobalPrivacyModal(); };
    const onConfirm = () => {
      // call delete flow
      this.deleteAccount();
      this.removeGlobalOverlay('global-delete-modal');
    };

    if (btnCancel) btnCancel.addEventListener('click', onClose);
    if (privacyLink) privacyLink.addEventListener('click', onPrivacyOpen);

    // expose a way for privacy modal to enable checkbox: set a global handler
    (window as any).__enableGlobalLgpd = () => {
      if (lgpdCheckbox) lgpdCheckbox.checked = true;
      if (btnConfirm) btnConfirm.disabled = false;
      this.lgpdChecked = true;
    };

    if (btnConfirm) btnConfirm.addEventListener('click', onConfirm);
  }

  private showGlobalPrivacyModal() {
    this.removeGlobalOverlay('global-privacy-modal');
    const container = document.createElement('div');
    container.id = 'global-privacy-modal';
    container.className = 'modal-overlay global';
  container.style.position = 'fixed';
  container.style.left = '0'; container.style.top = '0'; container.style.width = '100%'; container.style.height = '100%';
  container.style.display = 'flex'; container.style.alignItems = 'center'; container.style.justifyContent = 'center';
  container.style.zIndex = '100000';
  // backdrop so the privacy modal stands out above the page
  container.style.background = 'rgba(6,10,14,0.64)';
  (container.style as any).backdropFilter = 'blur(6px) saturate(120%)';
  (container.style as any).webkitBackdropFilter = 'blur(6px) saturate(120%)';
  // no padding on overlay container — modal-content controls its own padding
    container.innerHTML = `
      <div class="modal-content card privacy" role="dialog" aria-modal="true" style="max-width:720px; width:92%;">
        <header class="modal-header"><h3>Política de Privacidade</h3></header>
        <div class="modal-body" style="max-height:60vh; overflow:auto;">
          <p><strong>Resumo:</strong> Coletamos e processamos dados pessoais para fornecer os serviços contratados, cumprir obrigações legais e proteger nossos direitos. Você pode solicitar acesso, correção, portabilidade ou eliminação de seus dados conforme previsto na LGPD.</p>
          <div style="max-height:40vh; overflow:auto; padding:8px; border-radius:8px; background:rgba(0,0,0,0.02); margin-top:8px;">
            <p>— Coleta: Nome, email, telefone, histórico de compras, etc.</p>
            <p>— Finalidade: Processamento de pedidos, atendimento, notificações e melhorias.</p>
            <p>— Compartilhamento: Com parceiros de logística, pagamentos e conforme exigido por lei.</p>
            <p>— Direitos: Acesso, correção, anonimização, eliminação, portabilidade, revogação do consentimento.</p>
          </div>
        </div>
        <div class="modal-actions" style="display:flex; gap:8px; justify-content:flex-end; padding-top:12px;">
          <button class="btn btn-sec" id="global-privacy-close">Fechar</button>
          <button class="btn primary" id="global-privacy-agree">Concordo</button>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    // ensure overlay doesn't allow horizontal overflow and supports vertical scroll
    container.style.overflowX = 'hidden';
    container.style.overflowY = 'auto';
    try {
      const mc = container.querySelector('.modal-content') as HTMLElement | null;
      if (mc) { mc.style.margin = '0 auto'; mc.style.boxSizing = 'border-box'; mc.style.maxWidth = mc.style.maxWidth || '760px'; }
    } catch (e) {}

    const btnClose = container.querySelector('#global-privacy-close') as HTMLButtonElement | null;
    const btnAgree = container.querySelector('#global-privacy-agree') as HTMLButtonElement | null;

    const onClose = () => { this.removeGlobalOverlay('global-privacy-modal'); };
    const onAgree = () => {
      // enable LGPD on the delete modal
      try { (window as any).__enableGlobalLgpd && (window as any).__enableGlobalLgpd(); } catch (e) {}
      this.removeGlobalOverlay('global-privacy-modal');
    };

    if (btnClose) btnClose.addEventListener('click', onClose);
    if (btnAgree) btnAgree.addEventListener('click', onAgree);
  }

  // Called when user confirms inside the modal (requires LGPD checkbox)
  confirmDeleteAccountModal(): void {
    if (!this.lgpdChecked) { this.toast.info('É necessário concordar com a Política de Privacidade (LGPD) antes de prosseguir.'); return; }
    // close modal and proceed with deletion flow
    this.deleteModalOpen = false;
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
      return u.foto || '/imagens/image.png';
    } catch { return '/imagens/image.png'; }
  }

  // Which section is currently being edited (null = none). Sections: 'informacoes','endereco','preferencias','observacoes'
  // backups for canceling edits per-section
  private sectionBackup: any = {};

  editingSection: string | null = null;
  // When true only the header name is being edited (inline), do not open the full 'informacoes' editor
  editingNameOnly: boolean = false;

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
    // disable any inline-only name editor (don't allow both modes at once)
    this.editingNameOnly = false;
    // enable overall edit mode when any section enters edit
    this.editingSection = section;
    this.readOnly = false;
    // small UX: focus the first input inside the edited section so user sees it's editable
    try {
      window.setTimeout(()=>{
        if (section === 'informacoes') {
          const card = document.getElementById('informacoes-card');
          if (card) {
            const f = card.querySelector('input, select, textarea') as HTMLElement | null;
            if (f && typeof (f as any).focus === 'function') (f as any).focus();
          }
        }
      }, 80);
    } catch (e) { /* ignore */ }
    // scroll to top of modal to show form (if in modal)
    try { window.setTimeout(()=>{ const el = document.querySelector('.perfil-wrapper'); if (el) (el as any).scrollTop = 0; },50); } catch {}
  }

  // Start inline-only name edit (does not open the whole 'informacoes' section)
  editNameOnly(){
    if (this.editingSection) return; // prefer single edit mode at a time
    // Only enable the inline name editor. Do NOT flip global readOnly —
    // that would open the full-page edit form (undesired).
    this.sectionBackup.nomeOnly = this.nome;
    this.editingNameOnly = true;
    // focus handling can be done in template if needed
  }

  // Cancel inline name edit and restore backup
  cancelNameEdit(){
    if (this.sectionBackup.nomeOnly !== undefined) this.nome = this.sectionBackup.nomeOnly;
    this.editingNameOnly = false;
    this.readOnly = true;
  }

  // Save only the nome field (PATCH-like behaviour)
  saveNameOnly(){
    if (!this.token || !this.me?.user?.id) return;
    const payload: any = { nome: (this.nome||'').trim() };
    this.salvando = true;
    this.api.updateCliente(this.me.user.id, payload, this.token).subscribe({
      next: (res: any) => {
        this.toast.success('Nome atualizado!');
        // update local cached user name if present
        try { if (this.me && this.me.user) (this.me.user as any).nome = payload.nome; } catch {}
        delete this.sectionBackup.nomeOnly;
      },
      error: (err: any) => {
        const msg = err?.error?.message || err?.message || 'Erro ao salvar nome';
        this.toast.error(msg, 'Erro');
      },
      complete: () => {
        this.salvando = false;
        this.editingNameOnly = false;
        this.readOnly = true;
      }
    });
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
