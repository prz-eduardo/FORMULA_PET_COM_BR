import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { db } from '../../../../firebase-config';
import { collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { getCollectionItems, addCollectionItem, deleteCollectionItem } from '../firebase-helpers';

interface Produto {
  id?: string;
  name: string;
  description: string;
  price: number;
  image?: string | null;
  category: string;
  customizations: {
    dosage: string[];
    packaging: string[];
  };
  discount?: number | null;
  rating?: number | null;
  stock?: number | null;
  tags: string[];
  weightValue?: number | null;
  weightUnit?: string | null;
}

@Component({
  selector: 'app-produto',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './produto.component.html',
  styleUrls: ['./produto.component.scss']
})
export class ProdutoComponent implements OnInit {

  produto: Produto = {
    name: '',
    description: '',
    price: 0,
    category: '',
    customizations: { dosage: [], packaging: [] },
    tags: [],
    weightValue: 0,
    weightUnit: 'g'
  };

  // Coleções
  categoriasList: { id: string, name: string }[] = [];
  tagsList: { id: string, name: string }[] = [];
  embalagensList: { id: string, name: string }[] = [];
  dosagesList: { id: string, name: string }[] = [];

  // Modais
  showDosageModal = false;
  showPackagingModal = false;
  showTagModal = false;
  showCategoryModal = false;
  showSuccessModal = false;

  // Inputs novos
  newDosage = '';
  newPackaging = '';
  newTag = '';
  newCategory = '';

  constructor(private route: ActivatedRoute, public router: Router) {}

  async ngOnInit() {
    const produtoId = this.route.snapshot.queryParamMap.get('produto_id');
    if (produtoId) await this.fetchProdutoFromFirestore(produtoId);

    this.categoriasList = await this.fetchCollection('categorias');
    this.tagsList = await this.fetchCollection('tags');
    this.embalagensList = await this.fetchCollection('embalagens');
    this.dosagesList = await this.fetchCollection('dosages');
  }

private async fetchProdutoFromFirestore(id: string) {
  try {
    const docRef = doc(db, 'produtos', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as Produto;
      this.produto = {
        id: docSnap.id,
        ...data,
        customizations: {
          dosage: data.customizations?.dosage ?? [],
          packaging: data.customizations?.packaging ?? []
        }
      };
    } else {
      alert('Produto não encontrado!');
      this.router.navigate(['/restrito/admin']);
    }
  } catch (err) {
    console.error('Erro ao buscar produto:', err);
  }
}

  private async fetchCollection(name: string) {
    return (await getCollectionItems(name)).map((item: any) => ({
      id: item.id,
      name: item.name ?? ''
    }));
  }

  onImageSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => this.produto.image = e.target.result;
    reader.readAsDataURL(file);
  }

  // =================== DOSAGENS ===================
  toggleDosage(dos: string) {
    const idx = this.produto.customizations.dosage.indexOf(dos);
    if (idx > -1) this.produto.customizations.dosage.splice(idx, 1);
    else this.produto.customizations.dosage.push(dos);
  }

  async addDosage(d: string) {
    if (!d) return;

    // Adiciona no produto
    if (!this.produto.customizations.dosage.includes(d)) {
      this.produto.customizations.dosage.push(d);
    }

    // Adiciona na coleção global de dosagens
    if (!this.dosagesList.some(p => p.name.toLowerCase() === d.toLowerCase())) {
      await addCollectionItem('dosages', d);
      this.dosagesList = await this.fetchCollection('dosages');
    }

    this.newDosage = '';
    this.showDosageModal = false;
  }


  async removeDosage(dos: string, e: Event) {
  e.stopPropagation();

  // Remove do produto se estiver selecionada
  this.produto.customizations.dosage =
    this.produto.customizations.dosage.filter(d => d !== dos);

  if (confirm('Excluir dosagem do Firebase?')) {
    await deleteCollectionItem('dosages', dos);
    this.dosagesList = await this.fetchCollection('dosages');
  }
}


  // =================== EMBALAGENS ===================
  // togglePackaging(pack: string) {
  //   const idx = this.produto.customizations.packaging.indexOf(pack);
  //   if (idx > -1) this.produto.customizations.packaging.splice(idx, 1);
  //   else this.produto.customizations.packaging.push(pack);
  // }
  async addNewPackaging(packName: string) {
    if (!packName) return;
    if (!this.produto.customizations.packaging.includes(packName)) {
      this.produto.customizations.packaging.push(packName);
    }
    if (!this.embalagensList.some(p => p.name.toLowerCase() === packName.toLowerCase())) {
      await addCollectionItem('embalagens', packName);
      this.embalagensList = await this.fetchCollection('embalagens');
    }
    this.newPackaging = '';
    this.showPackagingModal = false;
  }

  // =================== TAGS ===================
  toggleTag(tagName: string) {
    const idx = this.produto.tags.indexOf(tagName);
    if (idx > -1) this.produto.tags.splice(idx, 1);
    else this.produto.tags.push(tagName);
  }
  async addNewTag(tagName: string) {
    if (!tagName) return;
    if (!this.produto.tags.includes(tagName)) this.produto.tags.push(tagName);
    if (!this.tagsList.some(t => t.name.toLowerCase() === tagName.toLowerCase())) {
      await addCollectionItem('tags', tagName);
      this.tagsList = await this.fetchCollection('tags');
    }
    this.newTag = '';
    this.showTagModal = false;
  }
  removeTag(tag: string) {
    this.produto.tags = this.produto.tags.filter(t => t !== tag);
  }

  // =================== CATEGORIAS ===================
  async addNewCategory(catName: string) {
    if (!catName) return;
    if (!this.categoriasList.some(c => c.name.toLowerCase() === catName.toLowerCase())) {
      await addCollectionItem('categorias', catName);
      this.categoriasList = await this.fetchCollection('categorias');
    }
    this.produto.category = catName;
    this.newCategory = '';
    this.showCategoryModal = false;
  }

  resetForm() {
    this.produto = {
      name: '',
      description: '',
      price: 0,
      category: '',
      customizations: { dosage: [], packaging: [] },
      tags: [],
      weightValue: 0,
      weightUnit: 'g'
    };
  }

  async submit() {
    try {
      const produtoId = this.produto.id ?? doc(collection(db, 'produtos')).id;
      this.produto.id = produtoId;
      await setDoc(doc(db, 'produtos', produtoId), { ...this.produto });
      this.showSuccessModal = true;
    } catch (err) {
      console.error('Erro ao salvar produto:', err);
    }
  }

  // =================== CATEGORIAS ===================
toggleCategory(name: string) {
  if (this.produto.category === name) this.produto.category = ''; // desmarcar
  else this.produto.category = name; // marcar
}

async removeCategory(name: string, e: Event) {
  e.stopPropagation();
  if (confirm('Excluir categoria do Firebase?')) {
    await deleteCollectionItem('categorias', name); // função do firebase
    this.categoriasList = await this.fetchCollection('categorias');
    if (this.produto.category === name) this.produto.category = '';
  }
}

// =================== EMBALAGENS ===================
togglePackaging(pack: string) {
  const idx = this.produto.customizations.packaging.indexOf(pack);
  if (idx > -1) this.produto.customizations.packaging.splice(idx, 1);
  else this.produto.customizations.packaging.push(pack);
}

removePackaging(pack: string, e: Event) {
  e.stopPropagation();
  this.produto.customizations.packaging =
    this.produto.customizations.packaging.filter(p => p !== pack);
}
fixRating(event: any) {
  let value = parseFloat(event.target.value);
  if (value > 5) value = 5;
  else if (value < 0) value = 0;
  this.produto.rating = value;
}

}
