import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type ClienteAreaModalView =
  | 'meus-pedidos'
  | 'meus-pets'
  | 'novo-pet'
  | 'perfil'
  | 'meus-enderecos'
  | 'meus-cartoes'
  | 'suporte'
  | 'postar-foto'
  | null;

@Injectable({
  providedIn: 'root'
})
export class ClienteAreaModalService {
  private readonly openRequestsSubject = new Subject<ClienteAreaModalView>();
  private readonly petsChangedSubject = new Subject<void>();
  private readonly galeriaFotosChangedSubject = new Subject<void>();

  readonly openRequests$ = this.openRequestsSubject.asObservable();
  readonly petsChanged$ = this.petsChangedSubject.asObservable();
  readonly galeriaFotosChanged$ = this.galeriaFotosChangedSubject.asObservable();

  open(view: ClienteAreaModalView = null): void {
    this.openRequestsSubject.next(view);
  }

  notifyPetsChanged(): void {
    this.petsChangedSubject.next();
  }

  notifyGaleriaFotosChanged(): void {
    this.galeriaFotosChangedSubject.next();
  }
}