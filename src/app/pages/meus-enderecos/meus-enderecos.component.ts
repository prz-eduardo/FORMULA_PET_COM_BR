import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

  @Component({
  selector: 'app-meus-enderecos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './meus-enderecos.component.html',
  styleUrls: ['./meus-enderecos.component.scss']
})
export class MeusEnderecosComponent {
  @Input() modal: boolean = false;
  @Output() close = new EventEmitter<void>();

  // Addresses will be loaded from the API. Keep a small fallback so UI renders if API fails.
  enderecos: any[] = [
    { id: 1, label: 'Casa', rua: 'Rua das Flores, 123', cidade: 'Curitiba', uf: 'PR', cep: '80000-000' },
    { id: 2, label: 'Trabalho', rua: 'Av. Central, 456', cidade: 'Curitiba', uf: 'PR', cep: '80010-000' }
  ];

  loading = false;
  cepCarregando = false;

  constructor(private api: ApiService, private auth: AuthService) {}

  ngOnInit(): void {
    this.loadEnderecos();
  }

  async loadEnderecos() {
    try {
      this.loading = true;
      const token = this.auth.getToken();
      if (!token) {
        this.enderecos = [];
        return;
      }
      const list = await this.api.listEnderecosCliente(token).toPromise();
      if (Array.isArray(list) && list.length) {
        // normalize minimal fields used by UI
        this.enderecos = list.map((e:any) => ({
          id: e.id || e._id || e.id_endereco || Math.random() * 100000,
          cliente_id: e.cliente_id || e.clienteId || null,
          label: e.nome || e.label || e.tipo || 'Endereço',
          tipo: e.tipo || 'outros',
          logradouro: e.logradouro || e.rua || e.endereco_text || '',
          numero: e.numero || e.numero || '',
          complemento: e.complemento || '',
          bairro: e.bairro || '',
          cidade: e.cidade || e.localidade || e.city || '',
          estado: e.estado || e.uf || '',
          cep: e.cep || ''
        }));
      } else {
        this.enderecos = [];
      }
    } catch (err) {
      console.error('Erro ao carregar endereços', err);
      // leave fallback or empty list
    } finally {
      this.loading = false;
    }
  }

  addEndereco() {
    // Open the detail modal in create mode
    this.selected = null;
    this.editing = true;
    this.editModel = { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', label: 'Casa', tipo: 'casa' };
    this.detailOpen = true;
  }

  doClose() { this.close.emit(); }

  // Detail modal state
  detailOpen = false;
  selected: any = null;
  editing = false;
  editModel: any = null;
  confirmOpen = false;
  toDelete: any = null;

  openDetails(e: any, edit: boolean = false) {
    this.selected = { ...e };
    this.detailOpen = true;
    this.editing = !!edit;
    // build editModel with API field names where possible
    this.editModel = {
      id: this.selected.id,
      cliente_id: this.selected.cliente_id,
      label: this.selected.label,
      tipo: this.selected.tipo || 'outros',
      cep: this.selected.cep,
      logradouro: this.selected.logradouro,
      numero: this.selected.numero,
      complemento: this.selected.complemento,
      bairro: this.selected.bairro,
      cidade: this.selected.cidade,
      estado: this.selected.estado
    };
  }

  closeDetails() {
    this.detailOpen = false;
    this.editing = false;
    this.editModel = null;
    this.selected = null;
  }

  enableEdit() { this.editing = true; this.editModel = { ...this.selected }; }
  cancelEdit() { this.editing = false; this.editModel = null; }

  saveEdit() {
    // If editing an existing address
    (async () => {
      try {
        const token = this.auth.getToken();
        // Normalize payload
        const payload: any = {
          cep: (this.editModel.cep || '').replace(/\D/g, ''),
          logradouro: this.editModel.logradouro,
          numero: this.editModel.numero,
          complemento: this.editModel.complemento,
          bairro: this.editModel.bairro,
          cidade: this.editModel.cidade,
          estado: this.editModel.estado,
          nome: this.editModel.label,
          tipo: this.editModel.tipo
        };
        if (this.selected && this.selected.id) {
          if (token) {
            const updated = await this.api.updateEnderecoCliente(token, this.selected.id, payload).toPromise();
            // merge back
            const idx = this.enderecos.findIndex((x:any) => x.id === this.selected.id);
            if (idx >= 0) this.enderecos[idx] = { ...this.enderecos[idx], ...updated };
            this.selected = { ...this.enderecos[idx] };
          } else {
            // local-only
            const idx = this.enderecos.findIndex((x:any) => x.id === this.selected.id);
            if (idx >= 0) this.enderecos[idx] = { ...this.enderecos[idx], ...this.editModel };
            this.selected = { ...this.enderecos[idx] };
          }
        } else {
          // create new
          if (token) {
            const created = await this.api.createEnderecoCliente(token, payload).toPromise();
            this.enderecos = [created, ...this.enderecos];
            this.selected = created;
          } else {
            const newId = Math.floor(Math.random() * 1000000);
            const created = { id: newId, ...this.editModel };
            this.enderecos = [created, ...this.enderecos];
            this.selected = created;
          }
        }
      } catch (err) {
        console.error('Erro ao salvar endereço', err);
      } finally {
        this.editing = false;
        this.editModel = null;
      }
    })();
  }

  confirmDelete(e: any) { this.toDelete = e; this.confirmOpen = true; }

  doDeleteConfirmed() {
    (async () => {
      if (!this.toDelete) return;
      const delId = this.toDelete.id;
      try {
        const token = this.auth.getToken();
        if (token) await this.api.deleteEnderecoCliente(token, delId).toPromise();
        this.enderecos = this.enderecos.filter((x:any) => x.id !== delId);
        if (this.detailOpen && this.selected?.id === delId) this.closeDetails();
      } catch (err) {
        console.error('Erro ao apagar endereço', err);
      } finally {
        this.toDelete = null;
        this.confirmOpen = false;
      }
    })();
  }

  // CEP helpers (mask + lookup) modeled after cart
  onCepInputMask(ev: any) {
    const raw = (ev?.target?.value ?? '').toString();
    const dig = raw.replace(/\D/g, '').slice(0, 8);
    const masked = dig.length > 5 ? `${dig.slice(0,5)}-${dig.slice(5)}` : dig;
    if (this.editModel) this.editModel.cep = masked;
  }

  async onCepBlurLookup() {
    if (!this.editModel) return;
    const cep = (this.editModel.cep || '').replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
      this.cepCarregando = true;
      const via = await this.api.buscarCepViaCep(cep).toPromise();
      if (via && !via.erro) {
        this.editModel.logradouro = via.logradouro || this.editModel.logradouro;
        this.editModel.bairro = via.bairro || this.editModel.bairro;
        this.editModel.cidade = via.localidade || this.editModel.cidade;
        this.editModel.estado = via.uf || this.editModel.estado;
        return;
      }
      const br = await this.api.buscarCepBrasilAPI(cep).toPromise();
      if (br) {
        this.editModel.logradouro = br.street || this.editModel.logradouro;
        this.editModel.bairro = br.neighborhood || this.editModel.bairro;
        this.editModel.cidade = br.city || this.editModel.cidade;
        this.editModel.estado = br.state || this.editModel.estado;
      }
    } catch (err) {
      // silent
    } finally {
      this.cepCarregando = false;
    }
  }

  tipoEmoji(tipo?: string): string {
    const t = (tipo || '').toLowerCase().trim();
    switch (t) {
      case 'casa': return '🏠';
      case 'trabalho': return '💼';
      case 'entrega': return '📦';
      case 'cobranca': return '🧾';
      default: return '📍';
    }
  }
}
