import { Component, Inject, PLATFORM_ID, Input, Output, EventEmitter, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService, ClienteMeResponse, PetImagemPatchPayload } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { NavmenuComponent } from '../../navmenu/navmenu.component';

@Component({
  selector: 'app-novo-pet',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NavmenuComponent],
  templateUrl: './novo-pet.component.html',
  styleUrls: ['./novo-pet.component.scss']
})
export class NovoPetComponent implements OnInit {
  @ViewChild('fotoPrincipalInput') fotoPrincipalInput?: ElementRef<HTMLInputElement>;
  @Input() modal: boolean = false;
  // When embedded in the area-cliente modal, parent can set editId to open edit mode
  @Input() editId?: string | number | null;
  /** Dados do cliente já carregados na área (evita janela de salvar com clienteMe nulo) */
  @Input() clienteDataInjected: any = null;
  @Output() close = new EventEmitter<void>();
  @Output() petSaved = new EventEmitter<void>();
  @Output() petDeleted = new EventEmitter<void>();
  // form fields
  nome = '';
  especie = '';
  raca = '';
  sexo: 'Macho' | 'Fêmea' | '' = '';
  pesoKg: number | null = null;
  idadeAnos: number | null = null;
  observacoes = '';
  // alergias livres removidas em favor do search-select
  // Predefinidas (get_lista_alergias)
  listaAlergias: { nome: string; alergia_id: string | number; ativo_id?: string | number }[] = [];
  alergiasSelecionadas: Array<{ nome: string; alergia_id: string | number; ativo_id?: string | number }> = [];
  // Temporarily store free-form allergy names until predef list is loaded
  pendingAlergiasLivres: string[] | null = null;
  alergiaBusca = '';
  sugestoes: Array<{ nome: string; alergia_id: string | number; ativo_id?: string | number }> = [];
  showSugestoes = false;
  // Item predefinido "Outras" (carregado do backend)
  outraPredefinida: { nome: string; alergia_id: string | number; ativo_id?: string | number } | null = null;

  showDeleteConfirm = false;
  showFotoPrincipalActionModal = false;
  salvandoFotoPrincipal = false;

  carregando = false;
  fotoPreviews: string[] = [];
  galeriaItens: any[] = [];
  existingGalleryUrls: string[] = [];
  existingFotoPrincipalUrl = '';
  clienteMe: ClienteMeResponse | null = null;

  especies = ['Cachorro', 'Gato', 'Outro'];
  sexos = ['Macho', 'Fêmea'];

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
  private router: Router,
  private route: ActivatedRoute,
    @Inject(PLATFORM_ID) private platformId: Object
  ){}

  get token(): string | null {
    return isPlatformBrowser(this.platformId) ? this.auth.getToken() : null;
  }

  /** `ClienteMeResponse.user.id` ou user injetado pela área do cliente (`clienteDataInjected`) */
  getClienteIdNum(): number | null {
    const c: any = this.clienteMe;
    if (!c) return null;
    const id = c.user?.id ?? c.id;
    const n = Number(id);
    return isNaN(n) || n <= 0 ? null : n;
  }

  ngOnInit(){
    const t = this.token;
    if (!t) return;
    if (this.clienteDataInjected?.id) {
      this.clienteMe = { user: this.clienteDataInjected };
    } else {
    this.api.getClienteMe(t).subscribe({
      next: (res) => this.clienteMe = res,
      error: () => {}
    });
    }

  // Edit mode: prefer programmatic editId (when embedded), otherwise use route param (editar-pet/:id)
  const routeId = this.route.snapshot.paramMap.get('id');
  const id = this.editId != null && String(this.editId) !== '' ? String(this.editId) : routeId;
  if (id && t) {
      // If clienteMe not loaded yet, we'll attempt a delayed fetch after it loads
      const loadPet = (clienteId: number) => {
        this.api.getPetsByCliente(clienteId, t).subscribe({
          next: (lista) => {
            const pet = (lista || []).find((p: any) => String(p.id || p._id) === String(id));
            if (pet) {
              this.nome = pet.nome || '';
              this.especie = pet.especie || '';
              this.raca = pet.raca || '';
              this.sexo = pet.sexo || '';
              const rawPeso = (pet.pesoKg ?? pet.peso ?? pet.peso_kg);
              this.pesoKg = rawPeso != null && rawPeso !== '' ? Number(rawPeso) : null;
              const rawIdade = (pet.idadeAnos ?? pet.idade);
              this.idadeAnos = rawIdade != null && rawIdade !== '' ? Number(rawIdade) : null;
              this.observacoes = pet.observacoes || '';
              this.existingFotoPrincipalUrl = this.normalizarFotoUrl(
                pet.photoURL || pet.foto || pet.photo || pet.photo_url || pet.imagem || ''
              );
              this.galeriaItens = Array.isArray(pet.galeria_imagens) ? pet.galeria_imagens : [];
              this.existingGalleryUrls = this.galeriaItens
                .map((item: any) => this.normalizarFotoUrl(item?.url))
                .filter((url: string) => !!url);
              if (!this.existingFotoPrincipalUrl && this.existingGalleryUrls.length) {
                this.existingFotoPrincipalUrl = this.existingGalleryUrls[0];
              }

              // Se backend retornar alergias já estruturadas (alergias_predefinidas), use-as
              if (Array.isArray(pet.alergias_predefinidas) && pet.alergias_predefinidas.length) {
                this.alergiasSelecionadas = pet.alergias_predefinidas.map((a: any) => ({ nome: a.nome || '', alergia_id: a.alergia_id ?? a.id ?? '', ativo_id: a.ativo_id }));
              } else {
                // Se backend retornar alergias por nome, tente mapear para lista predefinida depois de carregar a lista
                const livres = Array.isArray(pet.alergias)
                  ? pet.alergias
                  : (pet.alergias ? String(pet.alergias).split(/[;,]/).map((s:string)=>s.trim()).filter(Boolean) : []);
                // Se já temos a lista predefinida, mapeia imediatamente; senão guarda em pendente
                if (this.listaAlergias && this.listaAlergias.length) this.mapearAlergiasLivres(livres);
                else this.pendingAlergiasLivres = livres;
              }
            }
          }
        });
      };
      if (this.getClienteIdNum()) loadPet(this.getClienteIdNum()!);
      else {
        const int = setInterval(() => {
          const cid = this.getClienteIdNum();
          if (cid) { clearInterval(int); loadPet(cid); }
        }, 50);
        setTimeout(() => clearInterval(int), 4000);
      }
    }

    // Carregar lista predefinida de alergias (get_lista_alergias)
    this.carregarListaAlergias();
    // Buscar item predefinido "Outras" para mapear legados
    this.buscarOutrasPredefinida();
  }

  /** Id do pet em edição (rota ou `editId` em modal), ou null no cadastro novo. */
  getEffectiveEditId(): string | null {
    const routeId = this.route.snapshot.paramMap.get('id');
    if (this.editId != null && String(this.editId) !== '') return String(this.editId);
    return routeId;
  }

  get isEditMode(): boolean {
    return !!this.getEffectiveEditId();
  }

  cancelar(){
    if (this.modal) this.close.emit();
  }

  get fotoPrincipalAtual(): string {
    return this.fotoPreviews[0] || this.existingFotoPrincipalUrl || '';
  }

  onFotoPrincipalClick() {
    if (this.carregando || this.salvandoFotoPrincipal) return;
    if (this.fotoPrincipalAtual) {
      this.showFotoPrincipalActionModal = true;
      return;
    }
    this.abrirSeletorFotoPrincipal();
  }

  fecharModalFotoPrincipal() {
    if (this.salvandoFotoPrincipal) return;
    this.showFotoPrincipalActionModal = false;
  }

  selecionarSubstituirFotoPrincipal() {
    if (this.salvandoFotoPrincipal) return;
    this.showFotoPrincipalActionModal = false;
    this.abrirSeletorFotoPrincipal();
  }

  private abrirSeletorFotoPrincipal() {
    const input = this.fotoPrincipalInput?.nativeElement;
    if (!input) return;
    input.click();
  }

  onFotoPrincipalSelecionada(ev: Event) {
    if (!isPlatformBrowser(this.platformId)) return;
    const input = ev.target as HTMLInputElement;
    const file = input.files && input.files.length ? input.files[0] : null;
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toast.info('Selecione um arquivo de imagem válido.', 'Atenção');
      input.value = '';
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      this.toast.info('A imagem deve ter no máximo 3MB.', 'Atenção');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.fotoPreviews = [reader.result as string];
    };
    reader.readAsDataURL(file);

    const effectiveEditId = this.getEffectiveEditId();
    const cid = this.getClienteIdNum();
    if (!effectiveEditId || !this.token || !cid) {
      this.toast.info('A nova foto principal será enviada ao salvar os dados do pet.', 'Atenção');
      input.value = '';
      return;
    }

    const fd = new FormData();
    fd.append('foto', file);
    this.salvandoFotoPrincipal = true;
    this.carregando = true;
    this.api.updatePet(cid, effectiveEditId, fd, this.token).subscribe({
      next: () => {
        this.existingFotoPrincipalUrl = this.fotoPreviews[0] || this.existingFotoPrincipalUrl;
        this.toast.success('Foto principal atualizada com sucesso!');
        this.salvandoFotoPrincipal = false;
        this.carregando = false;
      },
      error: (err: any) => {
        this.fotoPreviews = [];
        const msg = err?.error?.message || err?.error?.error || err?.message || 'Erro ao atualizar foto principal';
        this.toast.error(msg, 'Erro');
        this.salvandoFotoPrincipal = false;
        this.carregando = false;
      }
    });

    input.value = '';
  }

  excluirFotoPrincipal() {
    if (this.salvandoFotoPrincipal || this.carregando) return;
    const effectiveEditId = this.getEffectiveEditId();
    const cid = this.getClienteIdNum();
    if (!effectiveEditId || !this.token || !cid) {
      this.toast.error('Não foi possível excluir a foto principal neste momento.', 'Erro');
      return;
    }

    const fd = new FormData();
    fd.append('photoURL', '');
    this.salvandoFotoPrincipal = true;
    this.carregando = true;
    this.api.updatePet(cid, effectiveEditId, fd, this.token).subscribe({
      next: () => {
        this.existingFotoPrincipalUrl = '';
        this.fotoPreviews = [];
        this.showFotoPrincipalActionModal = false;
        this.toast.success('Foto principal excluída.');
        this.salvandoFotoPrincipal = false;
        this.carregando = false;
      },
      error: (err: any) => {
        const msg = err?.error?.message || err?.error?.error || err?.message || 'Erro ao excluir foto principal';
        this.toast.error(msg, 'Erro');
        this.salvandoFotoPrincipal = false;
        this.carregando = false;
      }
    });
  }

  private normalizarFotoUrl(raw: any): string {
    return typeof raw === 'string' ? raw.trim() : '';
  }

  excluirPet() {
    const effectiveEditId = this.getEffectiveEditId();
    if (!effectiveEditId || !this.token || !this.getClienteIdNum()) {
      this.toast.error('Não é possível excluir: sessão inválida ou pet não carregado.', 'Erro');
      return;
    }
    this.showDeleteConfirm = true;
  }

  cancelarExclusaoPet() {
    if (this.carregando) return;
    this.showDeleteConfirm = false;
  }

  confirmarExclusaoPet() {
    const effectiveEditId = this.getEffectiveEditId();
    if (!effectiveEditId || !this.token || !this.getClienteIdNum()) {
      this.showDeleteConfirm = false;
      this.toast.error('Não é possível excluir: sessão inválida ou pet não carregado.', 'Erro');
      return;
    }
    const cid = this.getClienteIdNum()!;
    this.carregando = true;
    this.api.deletePet(cid, effectiveEditId, this.token).subscribe({
      next: () => {
        this.toast.success('Pet excluído.');
        this.carregando = false;
        this.showDeleteConfirm = false;
        this.petDeleted.emit();
        if (this.modal) {
          return;
        }
        this.router.navigateByUrl('/area-cliente');
      },
      error: (err: any) => {
        this.carregando = false;
        this.showDeleteConfirm = false;
        const st = err?.status;
        const body = err?.error;
        const msg =
          st === 409
            ? (body?.error || 'Este pet possui receitas vinculadas e não pode ser excluído.')
            : body?.error || body?.message || err?.message || 'Erro ao excluir pet';
        this.toast.error(msg, 'Erro');
      }
    });
  }

  carregarListaAlergias() {
    if (!this.token) return;
    // Carrega lista predefinida completa (usada para mapear nomes livres e sugestões rápidas)
    this.api.getListaAlergias(this.token).subscribe({
      next: (lista) => {
        this.listaAlergias = Array.isArray(lista) ? lista : [];
        if (this.pendingAlergiasLivres && this.pendingAlergiasLivres.length) {
          this.mapearAlergiasLivres(this.pendingAlergiasLivres);
          this.pendingAlergiasLivres = null;
        }
      },
      error: () => {}
    });
  }

  private buscarOutrasPredefinida() {
    if (!this.token) return;
    this.api.getListaAlergias(this.token, 'outras').subscribe({
      next: (lista) => {
        if (Array.isArray(lista)) {
          const found = lista.find(i => String(i.nome).trim().toLowerCase() === 'outras');
          if (found) this.outraPredefinida = found;
        }
      },
      error: () => {}
    });
  }

  filtrarSugestoes() {
    const termo = (this.alergiaBusca || '').trim();
    const lower = termo.toLowerCase();
    const jaSelecionados = new Set(this.alergiasSelecionadas.map(a => `${a.alergia_id}|${a.ativo_id ?? ''}`));

    if (!termo) {
      this.sugestoes = [];
      this.showSugestoes = false;
      return;
    }

    // Buscar do backend com ?q=...
    if (this.token) {
      this.api.getListaAlergias(this.token, termo).subscribe({
        next: (lista) => {
          // Remove os já selecionados
          const base = (lista || []).filter(a => !jaSelecionados.has(`${a.alergia_id}|${a.ativo_id ?? ''}`));
          // Filtro defensivo caso backend não aplique corretamente
          this.sugestoes = base.filter(a => a.nome?.toLowerCase().includes(lower)).slice(0, 20);
          this.showSugestoes = this.sugestoes.length > 0;
        },
        error: () => {
          this.sugestoes = [];
          this.showSugestoes = false;
        }
      });
    }
  }

  adicionarSugestao(item: { nome: string; alergia_id: string | number; ativo_id?: string | number }) {
    const key = `${item.alergia_id}|${item.ativo_id ?? ''}`;
    const exists = this.alergiasSelecionadas.some(a => `${a.alergia_id}|${a.ativo_id ?? ''}` === key);
    if (!exists) this.alergiasSelecionadas.push({ ...item });
    this.alergiaBusca = '';
    this.filtrarSugestoes();
  }

  // Mapeia nomes livres vindos do backend para a lista predefinida quando possível
  private mapearAlergiasLivres(livres: string[]) {
    if (!Array.isArray(livres) || !livres.length) return;
    const idx = new Map(this.listaAlergias.map(a => [a.nome.toLowerCase(), a] as const));
    let outrasJaAdicionada = this.alergiasSelecionadas.some(a => String(a.nome).trim().toLowerCase() === 'outras');
    livres.forEach(n => {
      const key = String(n).trim().toLowerCase();
      const hit = idx.get(key);
      if (hit) {
        const exists = this.alergiasSelecionadas.some(a => `${a.alergia_id}|${a.ativo_id ?? ''}` === `${hit.alergia_id}|${hit.ativo_id ?? ''}`);
        if (!exists) this.alergiasSelecionadas.push({ ...hit });
      } else if (!outrasJaAdicionada && this.outraPredefinida) {
        // Para nomes livres sem correspondência, agrega em "Outras" (predefinida)
        const already = this.alergiasSelecionadas.some(a => `${a.alergia_id}|${a.ativo_id ?? ''}` === `${this.outraPredefinida!.alergia_id}|${this.outraPredefinida!.ativo_id ?? ''}`);
        if (!already) {
          this.alergiasSelecionadas.push({ ...this.outraPredefinida });
          outrasJaAdicionada = true;
        }
      }
    });
    this.filtrarSugestoes();
  }

  salvar(){
    if (!this.nome || !this.especie || !this.sexo) {
      this.toast.info('Preencha os campos obrigatórios', 'Atenção');
      return;
    }
    if (!this.token || !this.getClienteIdNum()) {
      this.toast.error('Sessão inválida. Faça login novamente.', 'Erro');
      return;
    }
    const fd = new FormData();
    fd.append('nome', this.nome.trim());
    fd.append('especie', this.especie);
    if (this.raca) fd.append('raca', this.raca.trim());
    if (this.sexo) fd.append('sexo', this.sexo);
    if (this.pesoKg != null) fd.append('pesoKg', String(this.pesoKg));
    if (this.idadeAnos != null) fd.append('idadeAnos', String(this.idadeAnos));
    if (this.observacoes) fd.append('observacoes', this.observacoes.trim());
    // Enviar alergias predefinidas completas (nome, alergia_id, ativo_id)
    if (this.alergiasSelecionadas.length) {
      fd.append('alergias_predefinidas', JSON.stringify(this.alergiasSelecionadas));
    }

    this.carregando = true;
    const effectiveEditId = this.getEffectiveEditId();
    const cid = this.getClienteIdNum()!;
    const req$ = effectiveEditId
      ? this.api.updatePet(cid, effectiveEditId, fd, this.token!)
      : this.api.createPet(cid, fd, this.token!);
    req$.subscribe({
      next: () => {
        this.toast.success(effectiveEditId ? 'Pet atualizado com sucesso!' : 'Pet cadastrado com sucesso!');
        this.carregando = false;
        this.petSaved.emit();
        if (this.modal) {
          // O host (ex.: area-cliente) reabre "Meus pets" após petSaved; não chamar close aqui
          return;
        }
        this.router.navigateByUrl('/area-cliente');
      },
      error: (err: any) => {
        const msg = err?.error?.message || err?.error?.error || err?.message || 'Erro ao cadastrar pet';
        this.toast.error(msg, 'Erro');
        this.carregando = false;
      }
    });
  }
}
