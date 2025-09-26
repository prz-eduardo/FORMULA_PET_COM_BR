import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { getCollectionItems, addCollectionItem, updateCollectionItem, deleteCollectionItem } from '../firebase-helpers';
import { RouterLink } from '@angular/router';

// Import Node libs para scraping (vai rodar só no backend ou numa task Node)
import axios from 'axios';
import * as cheerio from 'cheerio';

@Component({
  selector: 'app-guia-ativos-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './guia-ativos.component.html',
  styleUrls: ['./guia-ativos.component.scss']
})
export class GuiaAtivosAdminComponent implements OnInit {
  ativos: any[] = [];
  showModal = false;
  editMode = false;
  ativoForm: any = { nome: '', descricao: '', especie: 'cachorro', doseCaes: '', doseGatos: '' };
  editId: string | null = null;

  async ngOnInit() {
    await this.loadAtivos();
    await this.scrapForVets();
  }

  async loadAtivos() {
    this.ativos = await getCollectionItems('ativos');
  }

  openModal(ativo?: any) {
    if (ativo) {
      this.editMode = true;
      this.editId = ativo.id;
      this.ativoForm = { ...ativo };
    } else {
      this.editMode = false;
      this.editId = null;
      this.ativoForm = { nome: '', descricao: '', especie: 'cachorro', doseCaes: '', doseGatos: '' };
    }
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  async saveAtivo() {
    if (this.editMode && this.editId) await updateCollectionItem('ativos', this.editId, this.ativoForm);
    else await addCollectionItem('ativos', this.ativoForm);
    this.closeModal();
    await this.loadAtivos();
  }

  async deleteAtivo(id: string) {
    if (confirm('Tem certeza que deseja deletar este ativo?')) {
      await deleteCollectionItem('ativos', id);
      await this.loadAtivos();
    }
  }

  trackById(index: number, item: any) { return item.id; }

  // ===========================
  // FUNÇÃO DE WEB SCRAPING
  // ===========================
  async scrapForVets() {
    const url = 'https://www.forvets.com.br/guia-de-ativos/';
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const rows = $('#guia table tbody tr');

    for (let i = 0; i < rows.length; i++) {
      const tr = rows.eq(i);
      const ativo = {
        nome: tr.find('td').eq(0).text().trim(),
        descricao: tr.find('td').eq(1).text().trim(),
        doseCaes: tr.find('td').eq(2).text().trim(),
        doseGatos: tr.find('td').eq(3).text().trim(),
        especie: 'cachorro', // default
      };

      console.log('Scraped ativo:', ativo);
      await addCollectionItem('ativos', ativo);
    }

    alert('Todos os ativos foram importados do ForVets!');
    await this.loadAtivos();
  }
}
