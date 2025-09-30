import { Component, OnInit, ViewChild, ElementRef, NgZone, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import { ApiService } from '../../../../services/api.service';
import { debounce } from 'lodash-es';
import jsPDF from 'jspdf';



interface Tutor {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  endereco: string;
  pets: Pet[];
}

interface Pet {
  id?: string;
  nome: string;
  especie: string;
  idade: number;
  peso: number;
  raca: string;
  sexo: 'Macho' | 'Fêmea';
  alergias?: string;
}

interface Ativo {
  id: string;
  nome: string;
  descricao: string;
  doseCaes: string;
  doseGatos: string;
  letra?: string;
}

@Component({
  selector: 'app-gerar-receita',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxMaskDirective],
  providers: [provideNgxMask()],
  templateUrl: './gerar-receita.component.html',
  styleUrls: ['./gerar-receita.component.scss']
})
export class GerarReceitaComponent implements OnInit, AfterViewInit {
  cpf = '';
  tutorEncontrado: Tutor | null = null;
  cadastroManualTutor = false;
  novoTutor: Tutor = { nome: '', cpf: '', telefone: '', email: '', endereco: '', pets: [] };

  petSelecionado: Pet | null = null;
  novosDadosPet: Pet = { nome: '', idade: 0, peso: 0, raca: '', sexo: 'Macho', alergias: '', especie:'' };
  observacoes = '';

  ativos: Ativo[] = [];
  alfabetico: { letra: string; ativos: Ativo[] }[] = [];
  ativosSelecionados: string[] = [];
  ativosColapsados = false;
  ativosSearch = '';
  carregandoAtivos = false;
  gruposColapsados = new Set<string>();

  assinaturaManual = '';
  assinaturaCursiva = '';
  assinaturaICP = '';
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx?: CanvasRenderingContext2D | null;
  private isDrawing = false;
  private lastX = 0;
  private lastY = 0;

  carregandoTutor = false;
  private debouncedFiltrarAtivos: () => void;

  constructor(private apiService: ApiService, private ngZone: NgZone) {
    this.debouncedFiltrarAtivos = debounce(this.filtrarAtivos.bind(this), 250);
  }

  ngOnInit(): void { this.loadAtivos(); }

  onCpfInput() { if (this.cpf.replace(/\D/g, '').length === 11) this.buscarTutor(); }

  async buscarTutor() {
    this.carregandoTutor = true;
    this.tutorEncontrado = null;
    this.petSelecionado = null;
    this.cadastroManualTutor = false;

    try {
      if (this.cpf === '11111111111') {
        this.ngZone.run(() => {
          this.tutorEncontrado = {
            nome: 'Maria Oliveira',
            cpf: '111.111.111-11',
            telefone: '(11) 98888-7777',
            email: 'maria@exemplo.com',
            endereco: 'Rua das Flores, 123 - São Paulo/SP',
            pets: [
              { id: 'pet-1', nome: 'Rex', idade: 5, peso: 20, raca: 'Labrador', sexo: 'Macho', alergias: 'Nenhuma', especie: 'Cachorro' },
              { id: 'pet-2', nome: 'Mimi', idade: 3, peso: 4, raca: 'Persa', sexo: 'Fêmea', alergias: 'Pólen' , especie: 'Cachorro'},
              { id: 'pet-3', nome: 'Bolt', idade: 2, peso: 15, raca: 'Border Collie', sexo: 'Macho', alergias: 'Carne bovina' , especie: 'Cachorro'}
            ]
          };
        });
      } else {
        this.ngZone.run(() => {
          this.cadastroManualTutor = true;
          this.novoTutor.cpf = this.cpf;
        });
      }
    } finally { this.carregandoTutor = false; }
  }

  selecionarPet(pet: Pet) { this.petSelecionado = pet; this.novosDadosPet = { ...pet }; }

  async loadAtivos() {
    this.carregandoAtivos = true;
    try {
      const ativosFromApi = await this.apiService.getAtivos().toPromise();
      this.ativos = ativosFromApi || [];
    } catch {
      this.ativos = [
        { id: '1', nome: 'Dipirona', descricao: 'Analgésico', doseCaes: '20mg/kg', doseGatos: '10mg/kg' },
        { id: '2', nome: 'Ivermectina', descricao: 'Antiparasitário', doseCaes: '0,2mg/kg', doseGatos: '—' },
        { id: '3', nome: 'Doxiciclina', descricao: 'Antibiótico', doseCaes: '5mg/kg', doseGatos: '5mg/kg' }
      ];
    } finally { this.organizarAtivos(); this.carregandoAtivos = false; }
  }

  organizarAtivos() {
    const grupos: Record<string, Ativo[]> = {};
    this.ativos.forEach(a => {
      const letra = (a.nome?.charAt(0) || '#').toUpperCase();
      a.letra = letra;
      if (!grupos[letra]) grupos[letra] = [];
      grupos[letra].push(a);
    });
    this.alfabetico = Object.keys(grupos).sort().map(l => ({ letra: l, ativos: grupos[l] }));
  }

  filtrarAtivos() {
    const termo = this.ativosSearch.trim().toLowerCase();
    if (!termo) return this.organizarAtivos();
    const res = this.ativos.filter(a => a.nome.toLowerCase().includes(termo) || a.descricao.toLowerCase().includes(termo));
    const grupos: Record<string, Ativo[]> = {};
    res.forEach(a => {
      const letra = (a.nome[0] || '#').toUpperCase();
      if (!grupos[letra]) grupos[letra] = [];
      grupos[letra].push(a);
    });
    this.alfabetico = Object.keys(grupos).sort().map(l => ({ letra: l, ativos: grupos[l] }));
  }

  onAtivosSearchChange() { this.debouncedFiltrarAtivos(); }

  toggleGrupo(letra: string) { this.gruposColapsados.has(letra) ? this.gruposColapsados.delete(letra) : this.gruposColapsados.add(letra); }
  isGrupoColapsado(letra: string) { return this.gruposColapsados.has(letra); }

  toggleTodosAtivos() {
    if (this.ativosColapsados) { this.gruposColapsados.clear(); this.ativosColapsados = false; }
    else { this.alfabetico.forEach(g => this.gruposColapsados.add(g.letra)); this.ativosColapsados = true; }
  }

  toggleAtivo(id: string) {
    this.ativosSelecionados.includes(id)
      ? this.ativosSelecionados = this.ativosSelecionados.filter(x => x !== id)
      : this.ativosSelecionados.push(id);
  }

  trackByPet(index: number, pet: Pet) { return pet.id ?? pet.nome ?? `${index}`; }
  trackByAtivo(index: number, ativo: Ativo) { return ativo.id; }

  ngAfterViewInit() { this.initCanvas(); }

  initCanvas() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    if (this.ctx) { this.ctx.scale(ratio, ratio); this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round'; this.ctx.lineWidth = 2.4; this.ctx.strokeStyle = '#000'; this.ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  canvasPointerDown(ev: PointerEvent) { this.isDrawing = true; this.setLast(ev); }
  canvasPointerMove(ev: PointerEvent) { if (this.isDrawing) this.draw(ev); }
  canvasPointerUp() { this.isDrawing = false; }

  private setLast(ev: PointerEvent) {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.lastX = ev.clientX - rect.left;
    this.lastY = ev.clientY - rect.top;
  }

  private draw(ev: PointerEvent) {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    if (!this.ctx) return;
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.lastX = x;
    this.lastY = y;
  }

  limparAssinaturaCanvas() {
    if (!this.ctx) return;
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.assinaturaICP = '';
  }

  gerarAssinaturaCursiva(nome: string) {
    if (!this.ctx) return;
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.ctx.font = `${Math.min(36, canvas.height/2)}px "Segoe Script", cursive`;
    this.ctx.fillStyle = '#000';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(nome, 10, canvas.height/2);
    this.assinaturaCursiva = nome;
    this.assinaturaICP = `icp-mock-${Date.now()}`;
  }

  salvarReceita() {
    const tutor = this.tutorEncontrado ?? this.novoTutor;
    const pet = this.petSelecionado ?? this.novosDadosPet;
    const assinaturaImg = this.canvasRef?.nativeElement.toDataURL() ?? null;
    console.log({ tutor, pet, ativos: this.ativosSelecionados, observacoes: this.observacoes, assinaturaManual: this.assinaturaManual, assinaturaCursiva: this.assinaturaCursiva, assinaturaImg, assinaturaICP: this.assinaturaICP });
    alert('Receita gerada! Veja console.');
  }

  getNomeAtivo(id: string): string {
  const ativo = this.ativos.find(a => a.id === id);
  return ativo ? ativo.nome : '';
}

gerarPdf() {
  const doc = new jsPDF();

  // Título
  doc.setFontSize(18);
  doc.text('Receita Veterinária', 105, 20, { align: 'center' });

  // Tutor
  doc.setFontSize(12);
  doc.text(`Nome do Tutor: ${this.tutorEncontrado?.nome || this.novoTutor.nome}`, 20, 40);
  doc.text(`CPF: ${this.tutorEncontrado?.cpf || this.novoTutor.cpf}`, 20, 50);
  doc.text(`Telefone: ${this.tutorEncontrado?.telefone || this.novoTutor.telefone}`, 20, 60);
  doc.text(`Email: ${this.tutorEncontrado?.email || this.novoTutor.email}`, 20, 70);
  doc.text(`Endereço: ${this.tutorEncontrado?.endereco || this.novoTutor.endereco}`, 20, 80);

  // Pet
  doc.text('--- Pet ---', 20, 95);
  doc.text(`Nome: ${this.novosDadosPet.nome}`, 20, 105);
  doc.text(`Espécie: ${this.novosDadosPet.especie}`, 20, 115);
  doc.text(`Raça: ${this.novosDadosPet.raca}`, 20, 125);
  doc.text(`Idade: ${this.novosDadosPet.idade} anos`, 20, 135);
  doc.text(`Peso: ${this.novosDadosPet.peso} kg`, 20, 145);
  doc.text(`Sexo: ${this.novosDadosPet.sexo}`, 20, 155);
  doc.text(`Alergias: ${this.novosDadosPet.alergias || 'Nenhuma'}`, 20, 165);

  // Observações
  doc.text('--- Observações ---', 20, 180);
  doc.text(this.observacoes || '-', 20, 190);

  // Gerar arquivo
  doc.save(`receita_${this.novosDadosPet.nome || 'pet'}.pdf`);
}
}
