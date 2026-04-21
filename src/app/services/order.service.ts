import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { SessionService } from './session.service';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  constructor(private api: ApiService, private session: SessionService) {}

  setStatus(orderId: string | number, status: string) {
    const token = this.session.getBackendToken();
    return this.api.adminSetOrderStatus(token, orderId, status);
  }

  cancel(orderId: string | number, motivo?: string) {
    const token = this.session.getBackendToken();
    return this.api.adminCancelOrder(token, orderId, motivo || '');
  }
}
