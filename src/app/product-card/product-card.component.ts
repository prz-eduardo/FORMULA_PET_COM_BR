import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Produto {
  id?: string;
  category?: string;
  customizations: {
    dosage: string[];
    packaging: string[];
    size?: string[];
    scent?: string[];
  };
  description?: string;
  image?: string;
  name?: string;
  price?: number;
  rating?: number;
  stock?: number;
  tags?: string[];
  weight?: string;
  isFavourite?: boolean;
  isAddedToCart?: boolean;
  discount?: number;
}

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.scss']
})
export class ProductCardComponent implements OnInit {
  @Input() id?: string;
  @Input() category?: string;
  @Input() customizations!: Produto['customizations'];
  @Input() description?: string;
  @Input() image?: string;
  @Input() name?: string;
  @Input() price?: number;
  @Input() rating?: number;
  @Input() stock?: number;
  @Input() tags?: string[];
  @Input() weight?: string;
  @Input() isFavourite?: boolean;
  @Input() isAddedToCart?: boolean;
  @Input() discount?: number;

  constructor() {}

  ngOnInit(): void {}
}
