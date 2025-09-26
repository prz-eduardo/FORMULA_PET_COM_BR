import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { getCollectionItems, addCollectionItem } from '../../restrito/admin/firebase-helpers';
import { isPlatformBrowser } from '@angular/common';
import { Inject, PLATFORM_ID } from '@angular/core';

@Component({
  selector: 'app-area-vet',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './area-vet.component.html',
  styleUrls: ['./area-vet.component.scss']
})
export class AreaVetComponent implements OnInit, AfterViewInit {

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ativos: any[] = [];
  filtro: string = '';
  isLoggedIn = false;
  vetApproved = false;

  viewMode: 'cards' | 'table' = 'cards';

  alfabetico: { letra: string, ativos: any[] }[] = [];

  ngOnInit() {}

  

  async ngAfterViewInit() {
    // this.ativos = await getCollectionItems("ativos");
    // this.organizarAtivos();
    if (isPlatformBrowser(this.platformId)) {
      this.loadAtivos();
    }
  }

  async loadAtivos() {
  this.ativos = await getCollectionItems("ativos");
  this.organizarAtivos();
}

  organizarAtivos() {
    const ativosOrdenados = [...this.ativos].sort((a,b) => a.nome.localeCompare(b.nome));
    const map = new Map<string, any[]>();

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
      especie: form.value.especie,
      peso: form.value.peso,
      paciente: form.value.paciente,
      dosagemCalculada: this.calcularDosagem(form.value.ativoId, form.value.peso),
      assinaturaGov: "TODO-integrar"
    };
    await addCollectionItem("receitas", receita);
    alert("Receita criada com sucesso!");
  }

  calcularDosagem(ativoId: string, peso: number): string {
    const ativo = this.ativos.find(a => a.id === ativoId);
    if (!ativo) return "";
    return `${peso * 10} mg`;
  }

  trackById(index: number, item: any) {
    return item.id;
  }

    get ativosFiltrados() {
    if (!this.filtro) return this.ativos;
    const termo = this.filtro.toLowerCase();
    return this.ativos.filter(a =>
      a.nome?.toLowerCase().includes(termo) ||
      a.descricao?.toLowerCase().includes(termo)
    );
  } 

  modalAberto = false;

abrirModal() {
  this.modalAberto = true;
}

fecharModal() {
  this.modalAberto = false;
}


}
