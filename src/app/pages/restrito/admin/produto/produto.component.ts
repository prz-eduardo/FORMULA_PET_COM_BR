import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';

interface Produto {
  id?: number;
  name: string;
  description: string;
  price: number;
  image?: string;
  category: string;
  customizations: {
    dosage: string[];
    packaging: string[];
  };
  discount?: number;
  rating?: number;
  stock?: number;
  tags: string[];
  weight?: string;
  weightUnit?: string; // para mg, kg, L, un
  weightValue?: number; // <-- adiciona aqui
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
  dosagensComuns = ['15mg', '30mg', '50mg'];
  embalagensComuns = ['Vidro', 'Plástico', 'Saco', 'Lata'];
  showDosageModal = false;
  showPackagingModal = false;
  showTagModal = false;
  newDosage = '';
  newPackaging = '';
  newTag = '';
  weightValue: number | null = null;
  weightUnit: string = 'g';

  constructor(private route: ActivatedRoute,public router: Router) {}

ngOnInit(): void {
  const produtoId = this.route.snapshot.queryParamMap.get('produto_id');
  if (produtoId) {
    this.fetchProdutoFromStorage(+produtoId);
  }
}

fetchProdutoFromStorage(id: number) {
  const produtosStored = localStorage.getItem('produtos');
  const produtos: Produto[] = produtosStored ? JSON.parse(produtosStored) : [];

  const produto = produtos.find(p => p.id === id);
  if (produto) {
    this.produto = { ...produto }; // copia para manter reatividade
  } else {
    alert('Produto não encontrado!');
    this.router.navigate(['/restrito/admin']); // volta pro admin se não achar
  }
}

  mockFetchProduto(id:number){
    // mock de produto
    this.produto = {
      id: id,
      name: "Suplemento para Cães - Vitaminas",
      description: "Suplemento vitamínico para cães com necessidades nutricionais especiais.",
      price: 39.90,
      image: "https://s2-ge.glbimg.com/A3qYbSZUHErnbuIK11hrm_NlQJo=/0x0:1254x836/984x0/smart/filters:strip_icc()/i.s3.glbimg.com/v1/AUTH_bc8228b6673f488aa253bbcb03c80ec5/internal_photos/bs/2023/W/Z/1ckIiORXqbN64zd2i9zw/istock-851155418.jpg",
      category: "Suplementos",
      customizations: {
        dosage: ["30mg"],
        packaging: ["Vidro"]
      },
      discount: 10,
      rating: 4.5,
      stock: 20,
      tags: ["vitaminas","cães"],
      weight: "500g",
      isFavourite: true,
      isAddedToCart: false
    }
  }

  onImageSelected(event: any){
    const file = event.target.files[0];
    if(file){
      const reader = new FileReader();
      reader.onload = (e:any) => this.produto.image = e.target.result;
      reader.readAsDataURL(file);
    }
  }

  toggleDosage(dos:string){
    const idx = this.produto.customizations.dosage.indexOf(dos);
    if(idx > -1) this.produto.customizations.dosage.splice(idx,1);
    else this.produto.customizations.dosage.push(dos);
  }

    addDosage(d:string){
    if(d && !this.produto.customizations.dosage.includes(d)){
      this.produto.customizations.dosage.push(d);
    }
  }

  setPackaging(pack:string){
    this.produto.customizations.packaging = [pack]; // radio style
  }

  addTag(tag:string){
    if(tag && !this.produto.tags.includes(tag)) this.produto.tags.push(tag);
  }

  removeTag(tag:string){
    this.produto.tags = this.produto.tags.filter(t=>t!==tag);
  }

submit(){
  const produtosStored = localStorage.getItem('produtos');
  let produtos: Produto[] = produtosStored ? JSON.parse(produtosStored) : [];

  if(this.produto.id){ 
    produtos = produtos.map(p => p.id === this.produto.id ? this.produto : p);
  } else {
    const maxId = produtos.length ? Math.max(...produtos.map(p=>p.id||0)) : 0;
    this.produto.id = maxId + 1;
    produtos.push(this.produto);
  }

  localStorage.setItem('produtos', JSON.stringify(produtos));

  // Abre modal de sucesso
  this.showSuccessModal = true;
}
  showSuccessModal = false;


  resetForm(){
    this.produto = {
      name: '',
      description: '',
      price: 0,
      category: '',
      customizations: { dosage: [], packaging: [] },
      tags: [],
    }
  }

  togglePackaging(pack: string){
    const idx = this.produto.customizations.packaging.indexOf(pack);
    if(idx > -1) this.produto.customizations.packaging.splice(idx,1);
    else this.produto.customizations.packaging.push(pack);
  }

 addPackaging(pack: string){
    if(pack && !this.produto.customizations.packaging.includes(pack)){
      this.produto.customizations.packaging.push(pack);
    }
  }

}
