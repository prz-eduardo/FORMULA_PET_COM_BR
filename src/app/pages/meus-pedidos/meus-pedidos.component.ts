import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavmenuComponent } from '../../navmenu/navmenu.component';
import { RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';

@Component({
  selector: 'app-meus-pedidos',
  standalone: true,
  imports: [CommonModule, FormsModule, NavmenuComponent, RouterOutlet],
  templateUrl: './meus-pedidos.component.html',
  styleUrls: ['./meus-pedidos.component.scss']
})
export class MeusPedidosComponent {
  pedidos: any[] = [];
  buscaCodigo = '';
  constructor(private router: Router){
    // Mock do FP-12345 (mesma base do modal)
    const now = new Date();
    const earlier = new Date(now.getTime() - 1000 * 60 * 60 * 24); // -1 dia
    const mid = new Date(now.getTime() - 1000 * 60 * 60 * 6); // -6 horas

    this.pedidos = [
      {
        codigo: 'FP-12345',
        status: 'Em manipulação',
        statusKey: 'em-manipulacao',
        criadoEm: earlier.toISOString(),
        atualizadoEm: mid.toISOString(),
        cliente: {
          nome: 'Maria Oliveira',
          cpf: '111.111.111-11',
          telefone: '(11) 98888-7777',
          email: 'maria.oliveira@example.com'
        },
        pet: {
          nome: 'Rex',
          especie: 'Cachorro',
          raca: 'Labrador',
          pesoKg: 24.8,
          idadeAnos: 5,
          sexo: 'Macho',
          alergias: 'Nenhuma conhecida'
        },
        veterinario: {
          nome: 'Dr. João Silva',
          crmv: 'SP-12345',
          telefone: '(11) 95555-4444',
          email: 'joao.silva@vetclinic.com'
        },
        pagamento: {
          metodo: 'PIX',
          status: 'Aprovado',
          valorTotal: 189.9
        },
        entrega: {
          tipo: 'Retirada na loja',
          prazo: 'Hoje após as 17h'
        },
        itens: [
          {
            nome: 'Suspensão de Metronidazol 50 mg/mL',
            forma: 'Suspensão oral',
            volumeMl: 100,
            concentracao: '50 mg/mL',
            posologia: '5 mL a cada 12 horas por 7 dias'
          },
          {
            nome: 'Cápsulas de Fluoxetina 10 mg',
            forma: 'Cápsulas gelatinosas',
            quantidade: 30,
            dosagem: '10 mg',
            posologia: '1 cápsula ao dia por 30 dias'
          }
        ]
      }
    ];
  }

  abrirStatus(codigo: string){
    // Abre o named outlet 'modal' com o componente de consulta e passa o código via query param
    this.router.navigate([
      '/meus-pedidos',
      { outlets: { modal: ['consultar-pedidos'] } }
    ], { queryParams: { codigo } });
  }

  consultarPorCodigo(){
    const code = (this.buscaCodigo || '').trim();
    if (!code) return;
    this.abrirStatus(code.toUpperCase());
  }

  voltar(){
    // Fecha qualquer modal aberto e volta para área do cliente
    this.router.navigateByUrl('/area-cliente');
  }
}
