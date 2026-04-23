import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { SupportTicketFacadeService } from '../support-ticket-facade.service';
import { SupportChatIdentityService } from '../support-chat-identity.service';
import { SupportMeta } from '../support.models';
import { ChatThreadComponent } from '../chat-thread/chat-thread.component';

@Component({
  selector: 'app-cliente-suporte-panel',
  standalone: true,
  imports: [CommonModule, ChatThreadComponent],
  templateUrl: './cliente-suporte-panel.component.html',
  styleUrls: ['./cliente-suporte-panel.component.scss'],
})
export class ClienteSuportePanelComponent implements OnInit, OnDestroy {
  /** Nome amigável para o atendente (ex.: nome do cliente). */
  @Input() clienteLabel = 'Cliente';

  ticketId: string | null = null;
  meta: SupportMeta | null = null;
  position = 0;
  totalInQueue = 0;
  loading = true;
  restarting = false;
  initErr = '';
  offMeta: (() => void) | null = null;
  offPos: (() => void) | null = null;

  constructor(
    private facade: SupportTicketFacadeService,
    private identity: SupportChatIdentityService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.bootstrapTicket();
  }

  private async bootstrapTicket() {
    this.loading = true;
    this.initErr = '';
    this.cdr.markForCheck();
    try {
      await this.identity.ensureFirebaseForChat();
      const tid = await this.facade.getOrCreateTicketForCliente(this.clienteLabel);
      this.attachSubscriptions(tid);
    } catch (e: any) {
      this.initErr = e?.message || 'Não foi possível abrir o chat';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private attachSubscriptions(tid: string) {
    this.teardownSubs();
    this.ticketId = tid;
    this.offMeta = this.facade.subscribeMeta(tid, (m) => {
      this.meta = m;
      this.cdr.markForCheck();
    });
    this.offPos = this.facade.subscribeQueuePosition(tid, (pos, tot) => {
      this.position = pos;
      this.totalInQueue = tot;
      this.cdr.markForCheck();
    });
  }

  private teardownSubs() {
    try {
      this.offMeta?.();
    } catch {
      // ignore
    }
    try {
      this.offPos?.();
    } catch {
      // ignore
    }
    this.offMeta = null;
    this.offPos = null;
  }

  ngOnDestroy() {
    this.teardownSubs();
  }

  async iniciarNovoAtendimento() {
    this.restarting = true;
    this.initErr = '';
    this.cdr.markForCheck();
    this.teardownSubs();
    this.ticketId = null;
    this.meta = null;
    this.position = 0;
    this.totalInQueue = 0;
    try {
      await this.identity.ensureFirebaseForChat();
      const tid = await this.facade.getOrCreateTicketForCliente(this.clienteLabel);
      this.attachSubscriptions(tid);
    } catch (e: any) {
      this.initErr = e?.message || 'Não foi possível iniciar um novo atendimento';
    } finally {
      this.restarting = false;
      this.cdr.markForCheck();
    }
  }

  statusTitle(): string {
    if (!this.meta) {
      return 'A preparar…';
    }
    if (this.meta.status === 'active') {
      return 'Em atendimento';
    }
    if (this.meta.status === 'closed') {
      return 'Atendimento encerrado';
    }
    return 'Na fila';
  }

  statusLine(): string {
    if (!this.meta) {
      return '';
    }
    if (this.meta.status === 'active') {
      return 'Um membro da equipe está com você. Envie sua dúvida abaixo.';
    }
    if (this.meta.status === 'closed') {
      return 'Este chat foi finalizado. Se precisar de algo novo, inicie outro atendimento.';
    }
    if (this.position > 0) {
      return `Sua posição: ${this.position} de ${this.totalInQueue || '—'}. Aguarde — respondemos por ordem de chegada.`;
    }
    return 'Conectando à fila…';
  }

  statusIconClass(): string {
    if (!this.meta) {
      return 'fa-solid fa-circle-notch fa-spin';
    }
    if (this.meta.status === 'active') {
      return 'fa-solid fa-headset';
    }
    if (this.meta.status === 'closed') {
      return 'fa-regular fa-circle-check';
    }
    return 'fa-regular fa-hourglass-half';
  }
}
