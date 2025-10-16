import { Component, OnInit, ViewChild, ElementRef, NgZone, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import { ApiService } from '../../../../services/api.service';
import { ToastService } from '../../../../services/toast.service';
import { debounce, slice } from 'lodash-es';
import jsPDF from 'jspdf';
import { jwtDecode } from "jwt-decode";
import html2canvas from 'html2canvas';
import { isPlatformBrowser } from '@angular/common';
import { Inject, PLATFORM_ID } from '@angular/core'
import { ChangeDetectorRef } from '@angular/core'
import { NavmenuComponent } from '../../../../navmenu/navmenu.component';





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
  alergias?: string[];
}

interface Ativo {
  id: string;
  nome: string;
  descricao: string;
  doseCaes: string;
  doseGatos: string;
  letra?: string;
}

interface Veterinario {
  id: string;
  nome: string;
  cpf: string;
  email: string;
  crmv: string;
}


@Component({
  selector: 'app-gerar-receita',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxMaskDirective,NavmenuComponent],
  providers: [provideNgxMask()],
  templateUrl: './gerar-receita.component.html',
  styleUrls: ['./gerar-receita.component.scss']
})
export class GerarReceitaComponent implements OnInit, AfterViewInit {
  @ViewChild('pdfContent') pdfContent!: ElementRef;
  cpf = '';
  tutorEncontrado: Tutor | null = null;
  cadastroManualTutor = false;
  novoTutor: Tutor = { nome: '', cpf: '', telefone: '', email: '', endereco: '', pets: [] };

  petSelecionado: Pet | null = null;
  novosDadosPet: Pet = { nome: '', idade: 0, peso: 0, raca: '', sexo: 'Macho', alergias: [], especie:'' };
  observacoes = '';
  veterinario: any;
isBrowser: any;
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
  alergiaInput: string = '';

  carregandoTutor = false;
  private debouncedFiltrarAtivos: () => void;

  constructor(
    private apiService: ApiService,
    private toastService: ToastService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
    ) {
    this.debouncedFiltrarAtivos = debounce(this.filtrarAtivos.bind(this), 250);
  }

  ngOnInit(): void { 
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (isPlatformBrowser(this.platformId)) {
      this.loadAtivos();
      this.carregarVeterinario();
    }
  }

  async carregarVeterinario() {
    if (!isPlatformBrowser(this.platformId)) return;
    
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('Token não encontrado no localStorage');
      return;
    }

    try {
      const decoded: any = jwtDecode(token);
      const vetId = decoded.id;
      const response = await this.apiService.getVeterinario(vetId, token).toPromise();
      this.veterinario = response;
    } catch (error) {
      console.error(error);
    }
  }

  getPetSexoAbreviado(pet: Pet | null) {
    if (!pet) return '';
    return pet.sexo === 'Macho' ? 'M' : pet.sexo === 'Fêmea' ? 'F' : '';
  }

  onCpfInput() { if (this.cpf.replace(/\D/g, '').length === 11) this.buscarTutor(); }

  async buscarTutor() {
    this.carregandoTutor = true;
    this.tutorEncontrado = null;
    this.petSelecionado = null;
    this.cadastroManualTutor = false;

    // Validação básica de CPF
    const cpfLimpo = this.cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      this.carregandoTutor = false;
      this.toastService.error('CPF inválido. Deve conter 11 dígitos.', 'Erro de Validação');
      return;
    }

    try {
      // Obter token do localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        this.toastService.error('Token de autenticação não encontrado. Faça login novamente.', 'Erro de Autenticação');
        this.carregandoTutor = false;
        return;
      }

      // Buscar cliente e pets no backend
      const response = await this.apiService.buscarClienteComPets(cpfLimpo, token).toPromise();
      
      if (response && response.cliente) {
        this.ngZone.run(() => {
          // Mapear os dados do backend para o formato esperado
          this.tutorEncontrado = {
            nome: response.cliente.nome || '',
            cpf: this.formatarCpf(response.cliente.cpf) || this.cpf,
            telefone: response.cliente.telefone || '',
            email: response.cliente.email || '',
            endereco: response.cliente.endereco || '',
            pets: (response.pets || []).map((pet: any) => ({
              id: pet.id?.toString() || '',
              nome: pet.nome || '',
              especie: pet.especie || '',
              idade: pet.idade || 0,
              peso: pet.peso || 0,
              raca: pet.raca || '',
              sexo: pet.sexo || 'Macho',
              alergias: pet.alergias || []
            }))
          };
        });
        this.toastService.success(`Cliente ${response.cliente.nome} encontrado com sucesso!`, 'Sucesso');
        this.cdr.detectChanges();
      } else {
        // Cliente não encontrado - habilitar cadastro manual
        this.ngZone.run(() => {
          this.cadastroManualTutor = true;
          this.novoTutor.cpf = this.cpf;
        });
        this.toastService.info('Cliente não encontrado. Por favor, preencha os dados manualmente.', 'Cliente não cadastrado');
      }
    } catch (error: any) {
      console.error('Erro ao buscar cliente:', error);
      
      // Se for erro 404, habilitar cadastro manual
      if (error.status === 404) {
        this.ngZone.run(() => {
          this.cadastroManualTutor = true;
          this.novoTutor.cpf = this.cpf;
        });
        this.toastService.info('Cliente não encontrado. Por favor, preencha os dados manualmente.', 'Cliente não cadastrado');
      } else {
        const errorMessage = error.error?.message || error.message || 'Erro desconhecido ao buscar cliente';
        this.toastService.error(errorMessage, 'Erro ao buscar cliente');
      }
    } finally { 
      this.carregandoTutor = false; 
    }
  }

  // Método auxiliar para formatar CPF
  formatarCpf(cpf: string): string {
    if (!cpf) return '';
    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) return cpf;
    return cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  selecionarPet(pet: Pet) {
    this.petSelecionado = pet;
    this.novosDadosPet = { ...pet, alergias: [...(pet.alergias || [])] };
  }

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

  ngAfterViewInit() { 
    if (isPlatformBrowser(this.platformId)) {
      this.initCanvas();
    }
  }

  initCanvas() {
    if (!isPlatformBrowser(this.platformId)) return;
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

  // --- Alergias como badges (chips) ---
  alergiasList(): string[] {
    const src = this.petSelecionado?.alergias ?? this.novosDadosPet.alergias ?? [];
    return (src as string[]).map(s => String(s).trim()).filter(Boolean);
  }

  addAlergiaChip() {
    const val = (this.alergiaInput || '').trim();
    if (!val) return;
    const list = this.alergiasList();
    if (!list.includes(val)) list.push(val);
    this.setAlergiasFromList(list);
    this.alergiaInput = '';
  }

  removeAlergiaChip(idx: number) {
    const list = this.alergiasList();
    list.splice(idx, 1);
    this.setAlergiasFromList(list);
  }

  private setAlergiasFromList(list: string[]) {
    const arr = [...list];
    if (this.petSelecionado) this.petSelecionado.alergias = arr;
    this.novosDadosPet.alergias = arr;
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
    const assinaturaImg = isPlatformBrowser(this.platformId)
    ? this.canvasRef?.nativeElement.toDataURL()
    : null;
    console.log({ tutor, pet, ativos: this.ativosSelecionados, observacoes: this.observacoes, assinaturaManual: this.assinaturaManual, assinaturaCursiva: this.assinaturaCursiva, assinaturaImg, assinaturaICP: this.assinaturaICP });
    alert('Receita gerada! Veja console.');
  }

  getNomeAtivo(id: string): string {
  const ativo = this.ativos.find(a => a.id === id);
  return ativo ? ativo.nome : '';
}

// gerarPdf() {
//   const doc = new jsPDF();
//   const margin = 20;
//   let y = 30;

//   // ===========================
//   // Cabeçalho
//   // ===========================
//   doc.setFont("times", "bold");
//   doc.setFontSize(20);
//   doc.text("RECEITA VETERINÁRIA", 105, y, { align: "center" });
//   y += 15;
//   doc.setDrawColor(0);
//   doc.line(margin, y, 210 - margin, y);
//   y += 20;

//   // ===========================
//   // Dados do Veterinário
//   // ===========================
//   doc.setFontSize(14).setFont("times", "bold");
//   doc.text("Dados do Veterinário", margin, y);
//   y += 10;
//   doc.setFont("times", "normal").setFontSize(12);
//   doc.text(`Nome: ${this.veterinario?.nome || "-"}`, margin, y); y += 7;
//   doc.text(`CPF: ${this.veterinario?.cpf || "-"}`, margin, y); y += 7;
//   doc.text(`CRMV: ${this.veterinario?.crmv || "-"}`, margin, y); y += 7;
//   doc.text(`Email: ${this.veterinario?.email || "-"}`, margin, y); y += 7;
//   doc.text(`Telefone: ${this.veterinario?.telefone || "-"}`, margin, y); y += 15;

//   // ===========================
//   // Dados do Tutor
//   // ===========================
//   doc.setFont("times", "bold").setFontSize(14);
//   doc.text("Dados do Tutor", margin, y);
//   y += 10;
//   const tutor = this.tutorEncontrado ?? this.novoTutor;
//   doc.setFont("times", "normal").setFontSize(12);
//   doc.text(`Nome: ${tutor?.nome || "-"}`, margin, y); y += 7;
//   doc.text(`CPF: ${tutor?.cpf || "-"}`, margin, y); y += 7;
//   doc.text(`Telefone: ${tutor?.telefone || "-"}`, margin, y); y += 7;
//   doc.text(`Email: ${tutor?.email || "-"}`, margin, y); y += 7;
//   doc.text(`Endereço: ${tutor?.endereco || "-"}`, margin, y); y += 15;

//   // ===========================
//   // Dados do Pet
//   // ===========================
//   doc.setFont("times", "bold").setFontSize(14);
//   doc.text("Dados do Pet", margin, y);
//   y += 10;
//   const pet = this.petSelecionado ?? this.novosDadosPet;
//   doc.setFont("times", "normal").setFontSize(12);
//   doc.text(`Nome: ${pet?.nome || "-"}`, margin, y); y += 7;
//   doc.text(`Espécie: ${pet?.especie || "-"}`, margin, y); y += 7;
//   doc.text(`Raça: ${pet?.raca || "-"}`, margin, y); y += 7;
//   doc.text(`Idade: ${pet?.idade || "-"} anos`, margin, y); y += 7;
//   doc.text(`Peso: ${pet?.peso || "-"} kg`, margin, y); y += 7;
//   doc.text(`Sexo: ${pet?.sexo || "-"}`, margin, y); y += 7;
//   doc.text(`Alergias: ${pet?.alergias || "Nenhuma"}`, margin, y); y += 15;

//   // ===========================
//   // Ativos em tabela
//   // ===========================
//   doc.setFont("times", "bold").setFontSize(14);
//   doc.text("Prescrição", margin, y);
//   y += 10;

//   if (this.ativosSelecionados.length) {
//     doc.setFontSize(11).setFont("times", "normal");
//     // Cabeçalho da tabela
//     doc.setFillColor('230');
//     doc.rect(margin, y, 170, 8, "F");
//     doc.text("Medicamento", margin + 2, y + 6);
//     doc.text("Dose Cães", margin + 90, y + 6);
//     doc.text("Dose Gatos", margin + 130, y + 6);
//     y += 12;

//     this.ativosSelecionados.forEach((id) => {
//       const ativo = this.ativos.find((a) => a.id === id);
//       if (ativo) {
//         doc.text(ativo.nome, margin + 2, y);
//         doc.text(ativo.doseCaes || "-", margin + 90, y);
//         doc.text(ativo.doseGatos || "-", margin + 130, y);
//         y += 8;
//       }
//     });
//   } else {
//     doc.setFont("times", "normal").setFontSize(12);
//     doc.text("Nenhum ativo selecionado.", margin, y);
//     y += 10;
//   }
//   y += 15;

//   // ===========================
//   // Observações
//   // ===========================
//   doc.setFont("times", "bold").setFontSize(14);
//   doc.text("Observações", margin, y);
//   y += 10;
//   doc.setFont("times", "normal").setFontSize(12);
//   const splitObs = doc.splitTextToSize(this.observacoes || "-", 170);
//   doc.text(splitObs, margin, y);
//   y += splitObs.length * 7 + 20;

//   // ===========================
//   // Assinatura
//   // ===========================
//   doc.setFont("times", "bold").setFontSize(14);
//   doc.text("Assinatura", 105, y, { align: "center" });
//   y += 15;

//   const canvas = this.canvasRef?.nativeElement;
//   const emptyCanvas =
//     canvas &&
//     this.ctx &&
//     this.ctx.getImageData(0, 0, canvas.width, canvas.height).data.every((p) => p === 0);

//   if (!emptyCanvas && canvas) {
//     const imgData = canvas.toDataURL("image/png");
//     doc.addImage(imgData, "PNG", 70, y, 70, 35);
//     y += 45;
//   } else {
//     doc.setFont("courier", "italic").setFontSize(16);
//     doc.text(this.veterinario?.nome || "____________________", 105, y, { align: "center" });
//     y += 20;
//   }

//   doc.setFont("times", "normal").setFontSize(10);
//   doc.text("Documento gerado digitalmente - Fórmula Pet", 105, 820, { align: "center" });

//   // ===========================
//   // Salvar
//   // ===========================
//   doc.save(`receita_${pet?.nome || "pet"}.pdf`);
// }

gerarPdf() {
  const element = this.pdfContent.nativeElement as HTMLElement;

  html2canvas(element, { scale: 2 }).then(canvas => {
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`receita_${this.petSelecionado?.nome || 'pet'}.pdf`);
  });
}

getDoseCaes(id: string): string {
  const ativo = this.ativos.find(a => a.id === id);
  return ativo?.doseCaes || '-';
}

getDoseGatos(id: string): string {
  const ativo = this.ativos.find(a => a.id === id);
  return ativo?.doseGatos || '-';
}


}
