import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface PaymentMethod {
  id?: string | number;
  provider?: string;
  last4?: string;
  brand?: string;
  exp_month?: number;
  exp_year?: number;
  holder_name?: string;
  is_default?: boolean;
  created_at?: string;
  metadata?: any;
}

@Injectable({
  providedIn: 'root'
})
export class CardsService {
  constructor(private api: ApiService) {}

  list(token: string): Observable<PaymentMethod[]> {
    return this.api.listMyCards(token);
  }

  create(token: string, payload: any) {
    return this.api.createCard(token, payload);
  }

  update(token: string, id: string | number, payload: any) {
    return this.api.updateCard(token, id, payload);
  }

  delete(token: string, id: string | number) {
    return this.api.deleteCard(token, id);
  }
}
