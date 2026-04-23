import { Component, Inject, PLATFORM_ID, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService, ClienteMeResponse } from '../../services/api.service';
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
  @Input() modal: boolean = false;
  // When embedded in the area-cliente modal, parent can set editId to open edit mode
  @Input() editId?: string | number | null;
  /** Dados do cliente já carregados na área (evita janela de salvar com clienteMe nulo) */
  @Input() clienteDataInjected: any = null;
  @Output() close = new EventEmitter<void>();
  @Output() petSaved = new EventEmitter<void>();
  // form fields
  nome = '';
  especie = '';
  raca = '';
  sexo: 'Macho' | 'Fêmea' | '' = '';
  pesoKg: number | null = null;
  idadeAnos: number | null = null;
  observacoes = '';
  /** Opt-in para aparecer na galeria pública (requer aprovação do admin). */
  exibirGaleriaPublica = false;
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

  // photo
  fotoFile: File | null = null;
  fotoPreview: string | null = null;

  carregando = false;
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
              const eg = pet.exibir_galeria_publica;
              this.exibirGaleriaPublica = !!(eg === 1 || eg === true || eg === '1' || String(eg).toLowerCase() === 'true');
              // Mostrar foto atual do pet (vários nomes possíveis retornados pelo backend)
              this.fotoPreview = pet.photoURL || pet.photoUrl || pet.foto || pet.photo || pet.photo_url || null;
              this.fotoFile = null;

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

  cancelar(){
    if (this.modal) this.close.emit();
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

  onFileChange(ev: Event) {
    if (!isPlatformBrowser(this.platformId)) return;
    const input = ev.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      this.toast.info('Selecione uma imagem válida', 'Atenção');
      return;
    }
    // opcional: limitar tamanho (3MB)
    if (file.size > 3 * 1024 * 1024) {
      this.toast.info('Imagem muito grande (máx. 3MB)', 'Atenção');
      return;
    }
    this.fotoFile = file;
    const reader = new FileReader();
    reader.onload = () => this.fotoPreview = reader.result as string;
    reader.readAsDataURL(file);
  }

  removerFoto(){
    this.fotoFile = null;
    this.fotoPreview = null;
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
    fd.append('exibir_galeria_publica', this.exibirGaleriaPublica ? '1' : '0');
    // Enviar alergias predefinidas completas (nome, alergia_id, ativo_id)
    if (this.alergiasSelecionadas.length) {
      fd.append('alergias_predefinidas', JSON.stringify(this.alergiasSelecionadas));
    }
    if (this.fotoFile) fd.append('foto', this.fotoFile);

    this.carregando = true;
    const routeParamId = this.route.snapshot.paramMap.get('id');
    const effectiveEditId =
      this.editId != null && String(this.editId) !== '' ? String(this.editId) : routeParamId;
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
