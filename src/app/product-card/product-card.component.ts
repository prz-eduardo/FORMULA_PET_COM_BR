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

private sanitizeText(text: string): string {
  return text.replace(/\*/g, ''); // remove todos os asteriscos
  // ou, se quiser mostrar o * mesmo:
  // return text.replace(/\*/g, '\\*');
}

enviarMsgWhatsApp() {
  const phoneNumber = '554132051910';

  const customizations: string[] = [];
  if (this.customizations?.dosage?.length) {
    customizations.push(
      `Dosagem: ${this.customizations.dosage.map(v => this.sanitizeText(v)).join(', ')}`
    );
  }
  if (this.customizations?.packaging?.length) {
    customizations.push(
      `Embalagem: ${this.customizations.packaging.map(v => this.sanitizeText(v)).join(', ')}`
    );
  }
  if (this.customizations?.size?.length) {
    customizations.push(
      `Tamanhos: ${this.customizations.size.map(v => this.sanitizeText(v)).join(', ')}`
    );
  }
  if (this.customizations?.scent?.length) {
    customizations.push(
      `Aroma: ${this.customizations.scent.map(v => this.sanitizeText(v)).join(', ')}`
    );
  }

  const message =
    `Olá! Tenho interesse no produto *${this.sanitizeText(this.name || '')}*.\n\n` +
    `*Categoria:* ${this.sanitizeText(this.category || 'Não informada')}\n` +
    `*Peso:* ${this.sanitizeText(this.weight || 'Não informado')}\n` +
    (customizations.length ? `*Customizações:*\n- ${customizations.join('\n- ')}\n` : '') +
    `*Preço:* R$ ${this.price?.toFixed(2) || 'Sob consulta'}\n\n` +
    `Poderia me passar mais informações?`;

  const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}




}
