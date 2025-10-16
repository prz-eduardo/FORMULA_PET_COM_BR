import { Component, Inject, PLATFORM_ID } from '@angular/core';
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
export class NovoPetComponent {
  // form fields
  nome = '';
  especie = '';
  raca = '';
  sexo: 'Macho' | 'Fêmea' | '' = '';
  pesoKg: number | null = null;
  idadeAnos: number | null = null;
  observacoes = '';
  alergiaInput = '';
  alergias: string[] = [];

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

  ngOnInit(){
    const t = this.token;
    if (!t) return;
    this.api.getClienteMe(t).subscribe({
      next: (res) => this.clienteMe = res,
      error: () => {}
    });

    // Edit mode: if route has :id, load pet and prefill
    const id = this.route.snapshot.paramMap.get('id');
    if (id && t) {
      const numId = Number(this.clienteMe?.user?.id);
      // If clienteMe not loaded yet, we'll attempt a delayed fetch after it loads
      const loadPet = (clienteId: number) => {
        this.api.getPetsByCliente(clienteId, t).subscribe({
          next: (lista) => {
            const pet = (lista || []).find((p: any) => String(p.id) === String(id));
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
              this.alergias = Array.isArray(pet.alergias)
                ? pet.alergias
                : (pet.alergias ? String(pet.alergias).split(/[;,]/).map((s:string)=>s.trim()).filter(Boolean) : []);
            }
          }
        });
      };
      if (this.clienteMe?.user?.id) loadPet(Number(this.clienteMe.user.id));
      else {
        // wait for clienteMe
        const int = setInterval(() => {
          if (this.clienteMe?.user?.id) { clearInterval(int); loadPet(Number(this.clienteMe.user.id)); }
        }, 50);
        setTimeout(() => clearInterval(int), 4000);
      }
    }
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

  addAlergia(){
    const v = (this.alergiaInput || '').trim();
    if (!v) return;
    if (!this.alergias.includes(v)) this.alergias.push(v);
    this.alergiaInput = '';
  }

  removeAlergia(i: number){
    this.alergias.splice(i, 1);
  }

  salvar(){
    if (!this.nome || !this.especie || !this.sexo) {
      this.toast.info('Preencha os campos obrigatórios', 'Atenção');
      return;
    }
    if (!this.token || !this.clienteMe?.user?.id) {
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
  if (this.alergias.length) fd.append('alergias', JSON.stringify(this.alergias));
    if (this.fotoFile) fd.append('foto', this.fotoFile);

    this.carregando = true;
    const editId = this.route.snapshot.paramMap.get('id');
    const req$ = editId
      ? this.api.updatePet(this.clienteMe.user.id, editId, fd, this.token!)
      : this.api.createPet(this.clienteMe.user.id, fd, this.token!);
    req$.subscribe({
      next: () => {
        this.toast.success(editId ? 'Pet atualizado com sucesso!' : 'Pet cadastrado com sucesso!');
        this.router.navigateByUrl('/area-cliente');
      },
      error: (err: any) => {
        const msg = err?.error?.message || err?.message || 'Erro ao cadastrar pet';
        this.toast.error(msg, 'Erro');
      },
      complete: () => this.carregando = false
    });
  }
}
