import { Component, OnInit, AfterViewInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { ApiService, Ativo } from '../../../services/api.service';
import { LoginVetComponent } from './login-vet/login-vet.component';
import { CrieSuaContaComponent } from './crie-sua-conta/crie-sua-conta.component';

@Component({
  selector: 'app-area-vet',
  standalone: true,
  imports: [CommonModule, FormsModule, LoginVetComponent, CrieSuaContaComponent, RouterLink],
  providers: [ApiService],
  templateUrl: './area-vet.component.html',
  styleUrls: ['./area-vet.component.scss']
})
export class AreaVetComponent implements OnInit, AfterViewInit { 

  ativos: any;
  filtro: string = '';
  isLoggedIn = false;
  vetApproved = false;
  vetData: any = null;

  viewMode: 'cards' | 'table' = 'cards';
  alfabetico: { letra: string, ativos: Ativo[] }[] = [];

  modalLoginAberto = false;
  modalCadastroAberto = false;
  modalReferenciasAberto = false;
  modalAvisoAberto = false;

  acordeonAtivo = true; // toggle de acordeon

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private authService: AuthService,
    private apiService: ApiService
  ) {}

ngOnInit() {
  this.authService.isLoggedIn$.subscribe(logged => {
    this.isLoggedIn = logged;

    if (logged) {
      const token = this.authService.getToken();
      if (!token) return;
      const payload: any = JSON.parse(atob(token.split('.')[1]));
      this.carregarVet(payload.id);
      this.modalLoginAberto = false;
      this.modalCadastroAberto = false;
    } else {
      this.vetData = null;
    }
  });
}


// função de carregar vet
carregarVet(vetId: string) {
  const token: string | undefined = localStorage.getItem('token') || undefined;

  this.apiService.getVet(vetId, token).toPromise()
    .then(vet => {
      console.log('_________________',vet);
      this.vetData = vet;
      this.vetApproved = vet?.approved || false;
    })
    .catch(err => {
      console.error('Erro ao buscar vet:', err);
      this.logout();
    });
}




  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadAtivos();
    }
  }

  temAtivos(): boolean {
    return this.alfabetico.some(l => (this.ativosFiltrados[l.letra] || []).length > 0);
  }


  organizarAtivos() {
    const ativosOrdenados = [...this.ativos].sort((a, b) => a.nome.localeCompare(b.nome));
    const map = new Map<string, Ativo[]>();
    ativosOrdenados.forEach(a => {
      const letra = a.nome[0].toUpperCase();
      if (!map.has(letra)) map.set(letra, []);
      map.get(letra)?.push(a);
    });
    this.alfabetico = Array.from(map, ([letra, ativos]) => ({ letra, ativos }));
  }

  ativosFiltradosPorLetra(letra: string) {
    this.ativos.forEach((a: Ativo) => a.open = false); // <--- tipo declarado
    const lista = this.alfabetico.find(l => l.letra === letra)?.ativos || [];
    if (!this.filtro) return lista;
    const termo = this.filtro.toLowerCase();
    return lista.filter((a: Ativo) =>
      a.nome?.toLowerCase().includes(termo) ||
      a.descricao?.toLowerCase().includes(termo)
    );
  }


  toggleAcordeon() {
    this.acordeonAtivo = !this.acordeonAtivo;
  }

  trackById(index: number, item: any) {
    return item.id;
  }

  abrirModalLogin() { this.modalLoginAberto = true; }
  fecharModalLogin() { this.modalLoginAberto = false; }

  abrirModalCadastro() { this.modalCadastroAberto = true; }
  fecharModalCadastro() { this.modalCadastroAberto = false; }

  abrirModalReferencias() { this.modalReferenciasAberto = true; }
  fecharModalReferencias() { this.modalReferenciasAberto = false; }

  logout() {
    // this.modalAvisoAberto = false;
    this.authService.logout();
    this.isLoggedIn = false;
    this.vetData = null;
  }

  dismissLogout(){
    this.modalAvisoAberto = false;
  }

  public async criarReceita(form: any) {
    const receita = {
      ativoId: form.value.ativoId,
      peso: form.value.peso,
      paciente: form.value.paciente,
      dosagemCalculada: this.calcularDosagem(form.value.ativoId, form.value.peso),
      assinaturaGov: "TODO-integrar"
    };
    try {
      await this.apiService.criarReceita(receita).toPromise();
      alert("Receita criada com sucesso!");
    } catch (err) {
      console.error('Erro ao criar receita:', err);
      alert("Erro ao criar receita. Veja o console.");
    }
  }

  calcularDosagem(id:any,peso:any){
    console.log('ainda não implementado');
  }

  expandirAtivo(ativo: Ativo) {
    console.log('chamoooou');
    // Fecha todos os cards
    this.alfabetico.forEach(l => l.ativos.forEach(a => a.open = false));

    // Desmarca toggle do acordeon
    this.acordeonAtivo = false;

    // Expande o card clicado
    ativo.open = true;
  }

  ativosFiltrados: { [letra: string]: Ativo[] } = {};

loadAtivos() {
  this.apiService.getAtivos().toPromise().then(ativos => {
    this.ativos = ativos;
    this.organizarAtivos();
    this.filtrarAtivos(); // inicializa o filtro
  });
}

filtrarAtivos() {
  const termo = this.filtro?.toLowerCase() || '';
  this.alfabetico.forEach(l => {
    this.ativosFiltrados[l.letra] = l.ativos.filter(a =>
      !termo || a.nome.toLowerCase().includes(termo) || a.descricao.toLowerCase().includes(termo)
    );
  });
}

onFiltroChange() {
  this.filtrarAtivos();
}

onLogin() {
  const token = localStorage.getItem('token') || undefined;
  if (!token) return;
  const payload: any = JSON.parse(atob(token.split('.')[1]));
  this.isLoggedIn = true;
  this.modalLoginAberto = false;
  this.modalCadastroAberto = false;
  this.carregarVet(payload.id);
}

}
