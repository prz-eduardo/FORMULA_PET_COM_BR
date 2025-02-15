import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import productsJson from '../../../public/products.json';

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [],
  templateUrl: './product-details.component.html',
  styleUrl: './product-details.component.scss'
})
export class ProductDetailsComponent implements OnInit {
  product: any;
  customization = {
    dosage: '',
    quantity: 1,
    packaging: ''
  };

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    const productId = +this.route.snapshot.paramMap.get('id')!;
    this.product = productsJson.find(p => p.id === productId);
  }

  handleFileUpload(event: any): void {
    console.log(event.target.files[0]);
  }

  submitOrder(): void {
    console.log('Pedido enviado com sucesso!');
  }
}
