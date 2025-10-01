import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

interface Pet {
  id: string;
  nome: string;
  tipo: string;
  photoURL?: string;
}

@Component({
  selector: 'app-area-cliente',
  standalone: true, // <-- importante
  imports: [CommonModule, FormsModule, RouterModule], // <-- importa o que usa no template
  templateUrl: './area-cliente.component.html',
  styleUrls: ['./area-cliente.component.scss']
})
export class AreaClienteComponent {
  isLoggedIn = false;
  clienteData: any = null;
  pets: Pet[] = [];

  modalLoginAberto = false;
  modalCadastroAberto = false;

  abrirModalLogin() { this.modalLoginAberto = true; }
  fecharModalLogin() { this.modalLoginAberto = false; }
  abrirModalCadastro() { this.modalCadastroAberto = true; }
  fecharModalCadastro() { this.modalCadastroAberto = false; }

  onLogin() {
    this.isLoggedIn = true;
    this.clienteData = { nome: 'Eduardo', photoURL: '' };
    this.pets = [
      { id:'1', nome:'Rex', tipo:'Cão', photoURL: '/assets/dog1.jpg' },
      { id:'2', nome:'Mimi', tipo:'Gato', photoURL: '/assets/cat1.jpg' }
    ];
  }

  logout() {
    this.isLoggedIn = false;
    this.clienteData = null;
    this.pets = [];
  }

  abrirCadastroPet() {
    alert('Abrir modal de cadastro de pet');
  }

  verDetalhesPet(pet: Pet) {
    alert(`Detalhes do pet: ${pet.nome}`);
  }
}
