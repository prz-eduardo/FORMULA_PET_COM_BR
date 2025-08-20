import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { db } from '../../../../firebase-config';
import { collection, doc, setDoc, getDoc } from 'firebase/firestore';

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
  weight?: string | null;
  weightUnit?: string | null;
  weightValue?: number | null;
  isFavourite?: boolean;
  isAddedToCart?: boolean;
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

  categorias = ['Suplementos', 'Brinquedos', 'Rações'];
  showDosageModal = false;
  showPackagingModal = false;
  showTagModal = false;
  newDosage = '';
  newPackaging = '';
  newTag = '';
  showSuccessModal = false;

  constructor(private route: ActivatedRoute, public router: Router) {}

  ngOnInit(): void {
    const produtoId = this.route.snapshot.queryParamMap.get('produto_id');
    if (produtoId) {
      this.fetchProdutoFromFirestore(produtoId);
    }
  }

  async fetchProdutoFromFirestore(id: string) {
    try {
      const docRef = doc(db, 'produtos', id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as Produto;
        this.produto = {
          id: docSnap.id,
          name: data.name || '',
          description: data.description || '',
          price: data.price || 0,
          category: data.category || '',
          customizations: data.customizations || { dosage: [], packaging: [] },
          discount: data.discount ?? null,
          rating: data.rating ?? null,
          stock: data.stock ?? null,
          tags: data.tags || [],
          weight: data.weight ?? null,
          weightValue: data.weightValue ?? 0,
          weightUnit: data.weightUnit ?? 'g',
          isFavourite: data.isFavourite ?? false,
          isAddedToCart: data.isAddedToCart ?? false,
          image: data.image ?? null
        };
      } else {
        alert('Produto não encontrado!');
        this.router.navigate(['/restrito/admin']);
      }
    } catch (err) {
      console.error('Erro ao buscar produto:', err);
    }
  }

  onImageSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => this.produto.image = e.target.result;
      reader.readAsDataURL(file);
    }
  }

  toggleDosage(dos: string) {
    const idx = this.produto.customizations.dosage.indexOf(dos);
    if (idx > -1) this.produto.customizations.dosage.splice(idx, 1);
    else this.produto.customizations.dosage.push(dos);
  }

  addDosage(d: string) {
    if (d && !this.produto.customizations.dosage.includes(d)) {
      this.produto.customizations.dosage.push(d);
    }
  }

  togglePackaging(pack: string) {
    const idx = this.produto.customizations.packaging.indexOf(pack);
    if (idx > -1) this.produto.customizations.packaging.splice(idx, 1);
    else this.produto.customizations.packaging.push(pack);
  }

  addPackaging(pack: string) {
    if (pack && !this.produto.customizations.packaging.includes(pack)) {
      this.produto.customizations.packaging.push(pack);
    }
  }

  addTag(tag: string) {
    if (tag && !this.produto.tags.includes(tag)) this.produto.tags.push(tag);
  }

  removeTag(tag: string) {
    this.produto.tags = this.produto.tags.filter(t => t !== tag);
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

    const produtoData = {
      name: this.produto.name ?? '',
      description: this.produto.description ?? '',
      price: this.produto.price ?? 0,
      category: this.produto.category ?? '',
      customizations: {
        dosage: this.produto.customizations?.dosage ?? [],
        packaging: this.produto.customizations?.packaging ?? []
      },
      discount: this.produto.discount ?? null,
      rating: this.produto.rating ?? null,
      stock: this.produto.stock ?? null,
      tags: this.produto.tags ?? [],
      weightValue: this.produto.weightValue ?? null,
      weightUnit: this.produto.weightUnit ?? null,
      isFavourite: this.produto.isFavourite ?? false,
      isAddedToCart: this.produto.isAddedToCart ?? false,
      image: this.produto.image?.substring(0, 500) ?? null // só exemplo, evita doc muito grande
    };

    await setDoc(doc(db, 'produtos', produtoId), produtoData);

    this.showSuccessModal = true;

  } catch (err) {
    console.error('Erro ao salvar produto:', err);
  }
}

}
