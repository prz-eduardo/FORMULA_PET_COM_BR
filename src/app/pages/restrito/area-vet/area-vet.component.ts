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
  imports: [CommonModule, FormsModule, LoginVetComponent, CrieSuaContaComponent],
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

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private authService: AuthService,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    this.authService.user$.subscribe(async user => {
      if (user) {
        this.isLoggedIn = true;
        this.vetData = await this.apiService.getVet(user.uid).toPromise();
        this.vetApproved = this.vetData?.approved || false;
      } else {
        this.isLoggedIn = false;
        this.vetData = null;
        this.vetApproved = false;
      }
    });

    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.isLoggedIn = true;
      this.apiService.getVet(currentUser.uid).subscribe(vet => {
        this.vetData = vet;
        this.vetApproved = vet?.approved || false;
      });
    }
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadAtivos();
    }
  }

  async loadAtivos() {
    try {
      this.ativos = await this.apiService.getAtivos().toPromise();
      this.organizarAtivos();
    } catch (err) {
      console.error('Erro ao carregar ativos:', err);
    }
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
    if (!this.filtro) return this.alfabetico.find(l => l.letra === letra)?.ativos || [];
    const termo = this.filtro.toLowerCase();
    return (this.alfabetico.find(l => l.letra === letra)?.ativos || []).filter(a =>
      a.nome?.toLowerCase().includes(termo) ||
      a.descricao?.toLowerCase().includes(termo)
    );
  }

  async criarReceita(form: any) {
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

calcularDosagem(ativoId: any, peso: number): any {
  const ativo: Ativo | undefined = this.ativos.find((a: Ativo) => a.id === ativoId);
  if (!ativo) return "";
  return `${peso * 10} mg`;
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

}