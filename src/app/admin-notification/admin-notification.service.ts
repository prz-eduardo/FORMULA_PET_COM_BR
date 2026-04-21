import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface AdminNotification {
  message: string;
  time: Date;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminNotificationService {
  private _notifications = new BehaviorSubject<AdminNotification[]>([]);
  notifications$ = this._notifications.asObservable();

  constructor() {
    // Chame aqui o método de integração real (exemplo: this.connectToBackend())
    // this.connectToBackend();
  }

  // Exemplo de integração real (substitua pelo seu endpoint ou WebSocket)
  // connectToBackend() {
  //   // Exemplo HTTP polling:
  //   // this.http.get<AdminNotification[]>(url).subscribe(data => this._notifications.next(data));
  //   // Exemplo WebSocket:
  //   // const ws = new WebSocket('ws://seu-backend');
  //   // ws.onmessage = (event) => {
  //   //   const data = JSON.parse(event.data);
  //   //   this._notifications.next([data, ...this._notifications.value]);
  //   // };
  // }

  markAllAsRead() {
    const updated = this._notifications.value.map(n => ({ ...n, read: true }));
    this._notifications.next(updated);
  }

  // Adapte para integração real com backend
  // Exemplo: conectar WebSocket e atualizar _notifications
}
