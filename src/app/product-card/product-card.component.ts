import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss'
})
export class ProductCardComponent implements OnInit {
@Input() id: number | undefined;
@Input() category: string | undefined;
@Input() customizations: { dosage: string[], packaging: string[] } | undefined;
@Input() description: string | undefined;
@Input() image: string | undefined;
@Input() name: string | undefined;
@Input() price: number | undefined;


constructor() {
 
}

ngOnInit(): void {
 }
}
