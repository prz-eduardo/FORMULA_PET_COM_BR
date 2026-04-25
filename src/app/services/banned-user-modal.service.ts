import { Injectable, signal } from '@angular/core';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class BannedUserModalService {
  private readonly _visible = signal(false);
  readonly visible = this._visible.asReadonly();
  private _banFlowInFlight = false;

  constructor(private auth: AuthService) {}

  show(): void {
    this._visible.set(true);
  }

  hide(): void {
    this._visible.set(false);
  }

  /** Encerra Firebase + JWT local e abre o modal (login recusado por conta banida). */
  async presentAfterBannedLogin(): Promise<void> {
    if (this._visible()) return;
    if (this._banFlowInFlight) return;
    this._banFlowInFlight = true;
    try {
      try {
        await this.auth.signOutFirebase();
      } catch {
        /* */
      }
      this.auth.logout();
      try {
        localStorage.removeItem('userType');
        sessionStorage.removeItem('userType');
      } catch {
        /* */
      }
      this.show();
    } finally {
      this._banFlowInFlight = false;
    }
  }
}
