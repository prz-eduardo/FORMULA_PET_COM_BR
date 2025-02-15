import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.scss']
})
export class ProductCardComponent implements OnInit {
  @Input() id: number | undefined;
  @Input() category: string | undefined;
  @Input() customizations: any | undefined; // Pode conter: { dosage, packaging } ou { size, scent }
  @Input() description: string | undefined;
  @Input() image: string | undefined;
  @Input() name: string | undefined;
  @Input() price: number | undefined;
  @Input() rating: number | undefined;
  @Input() stock: number | undefined;
  @Input() tags: string[] | undefined;
  @Input() weight: string | undefined;
  @Input() isFavourite: boolean | undefined;
  @Input() isAddedToCart: boolean | undefined;
  @Input() discount: number | undefined;

  constructor() {}

  ngOnInit(): void {}
}
