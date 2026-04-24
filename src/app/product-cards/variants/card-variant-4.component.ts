import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductCardBase } from '../shared/product-card-base';

@Component({
  selector: 'app-card-variant-4',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, RouterLink],
  templateUrl: './card-variant-4.component.html',
  styleUrls: ['./card-variant-4.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardVariant4Component extends ProductCardBase {}
