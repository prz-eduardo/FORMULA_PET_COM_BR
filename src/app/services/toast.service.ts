import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  timeout?: number; // ms
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  public toasts$ = this.toastsSubject.asObservable();

  private uid() { return Math.random().toString(36).slice(2, 9); }

  show(message: string, type: ToastType = 'info', title?: string, timeout = 4000) {
    const t: Toast = { id: this.uid(), type, title, message, timeout };
    const arr = [...this.toastsSubject.value, t];
    this.toastsSubject.next(arr);

    if (timeout && timeout > 0) {
      setTimeout(() => this.dismiss(t.id), timeout);
    }
    return t.id;
  }

  success(message: string, title?: string, timeout = 4000) { return this.show(message, 'success', title, timeout); }
  error(message: string, title?: string, timeout = 6000) { return this.show(message, 'error', title, timeout); }
  info(message: string, title?: string, timeout = 4000) { return this.show(message, 'info', title, timeout); }

  dismiss(id: string) {
    const arr = this.toastsSubject.value.filter(t => t.id !== id);
    this.toastsSubject.next(arr);
  }

  clear() { this.toastsSubject.next([]); }
}
