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
  initErr = '';
  offMeta: (() => void) | null = null;
  offPos: (() => void) | null = null;

  constructor(
    private facade: SupportTicketFacadeService,
    private identity: SupportChatIdentityService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    this.loading = true;
    this.initErr = '';
    try {
      const tid = await this.facade.getOrCreateTicketForCliente(this.clienteLabel);
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
    } catch (e: any) {
      this.initErr = e?.message || 'Não foi possível abrir o chat';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy() {
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
  }

  statusLine(): string {
    if (!this.meta) {
      return '';
    }
    if (this.meta.status === 'active') {
      return 'Você está em atendimento com a nossa equipe.';
    }
    if (this.meta.status === 'closed') {
      return 'Este atendimento foi encerrado. Se precisar, abra novamente mais tarde.';
    }
    if (this.position > 0) {
      return `Posição na fila: ${this.position} de ${this.totalInQueue || '—'}`;
    }
    return 'Aguardando posição na fila…';
  }
}
