import { Component, OnInit, AfterViewInit, Inject, PLATFORM_ID,Injectable } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';
import { ApiService, Ativo } from '../../../services/api.service';
import { LoginVetComponent } from './login-vet/login-vet.component';
import { CrieSuaContaComponent } from './crie-sua-conta/crie-sua-conta.component';
import { NavmenuComponent } from '../../../navmenu/navmenu.component';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'app-area-vet',
  standalone: true,
  imports: [CommonModule, FormsModule, LoginVetComponent, CrieSuaContaComponent, RouterLink,NavmenuComponent],
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
    private apiService: ApiService,
    private parceiroAuth: ParceiroAuthService
  ) {}

  getEffectiveToken(): string | null {
    try { const t = this.authService?.getToken && this.authService.getToken(); if (t) return t; } catch {}
    try { const pt = this.parceiroAuth?.getToken && this.parceiroAuth.getToken(); if (pt) return pt; } catch {}
    if (isPlatformBrowser(this.platformId)) {
      try { return localStorage.getItem('token') || sessionStorage.getItem('token') || null; } catch {}
    }
    return null;
  }

ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const token = this.getEffectiveToken();
      if (token) {
        try {
          const payload: any = JSON.parse(atob(String(token).split('.')[1]));
          // If token belongs to a vet, try loading vet data
          const role = payload?.tipo || payload?.role;
          if (payload?.id && (role === 'vet' || role === 'veterinario' || role === undefined)) {
            this.carregarVet(String(payload.id), token);
          } else {
            // Partner token or non-vet token: mark as logged (partner) but no vet data
            const colaborador = this.parceiroAuth.getCurrentColaborador();
            if (colaborador) {
              this.isLoggedIn = true;
              this.modalLoginAberto = false;
              this.modalCadastroAberto = false;
              this.vetData = null;
              this.vetApproved = true;
            }
          }
        } catch {
          // ignore token parsing errors
        }
      }
    }

    this.authService.isLoggedIn$.subscribe((status) => {
      this.isLoggedIn = status;
    });
    this.authService.isLoggedIn$.subscribe(logged => {
      this.isLoggedIn = logged;

      if (logged) {
        const token = this.authService.getToken();
        if (!token) return;
        try {
          const payload: any = JSON.parse(atob(String(token).split('.')[1]));
          this.carregarVet(String(payload.id), token);
        } catch {}
        this.modalLoginAberto = false;
        this.modalCadastroAberto = false;
      } else {
        this.vetData = null;
      }
    });
}


// função de carregar vet
carregarVet(vetId: string, token?: string) {
  const effective = token || (isPlatformBrowser(this.platformId) ? this.authService.getToken() || undefined : undefined);

  this.apiService.getVet(vetId, effective).toPromise()
    .then(vet => {
      this.vetData = vet;
      this.vetApproved = vet?.approved || false;
    })
    .catch(err => {
      console.error('Erro ao buscar vet:', err);
      // Do not force logout when partner is creating recipes; just clear vet data
      this.vetData = null;
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
  const token = this.getEffectiveToken();
  if (!token) return;
  let payload: any = null;
  try { payload = JSON.parse(atob(String(token).split('.')[1])); } catch {}
  this.isLoggedIn = true;
  this.modalLoginAberto = false;
  this.modalCadastroAberto = false;
  if (payload?.id) this.carregarVet(payload.id, token);
}

}
