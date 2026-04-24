import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { SupportTicketFacadeService } from '../../../../features/support-chat/support-ticket-facade.service';
import { SupportChatIdentityService } from '../../../../features/support-chat/support-chat-identity.service';
import { AdminQueueRow, SupportMeta } from '../../../../features/support-chat/support.models';
import { ChatThreadComponent } from '../../../../features/support-chat/chat-thread/chat-thread.component';

@Component({
  selector: 'app-atendimento',
  standalone: true,
  imports: [CommonModule, ChatThreadComponent],
  templateUrl: './atendimento.component.html',
  styleUrls: ['./atendimento.component.scss'],
})
export class AtendimentoAdminComponent implements OnInit, OnDestroy {
  workload: AdminQueueRow[] = [];
  selectedId: string | null = null;
  meta: SupportMeta | null = null;
  query = '';
  loading = true;
  initErr = '';
  workloadErr = '';
  err = '';
  busy = false;
  offQueue: (() => void) | null = null;
  offMeta: (() => void) | null = null;

  constructor(
    private facade: SupportTicketFacadeService,
    private identity: SupportChatIdentityService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    this.loading = true;
    this.initErr = '';
    try {
      await this.identity.ensureFirebaseForChat();
      this.offQueue = this.facade.subscribeAdminWorkload(
        (rows) => {
          this.workload = rows;
          this.workloadErr = '';
          this.cdr.markForCheck();
        },
        (error) => {
          this.workloadErr = this.describeWorkloadError(error);
          this.cdr.markForCheck();
        }
      );
    } catch (e: any) {
      this.initErr = e?.message || 'Não foi possível iniciar o atendimento';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy() {
    try {
      this.offQueue?.();
    } catch {
      // ignore
    }
    this.clearMeta();
  }

  select(ticketId: string) {
    this.clearMeta();
    this.selectedId = ticketId;
    this.offMeta = this.facade.subscribeMeta(
      ticketId,
      (m) => {
        this.meta = m;
        this.cdr.markForCheck();
      },
      (error) => {
        this.err = this.describeWorkloadError(error);
        this.cdr.markForCheck();
      }
    );
  }

  private clearMeta() {
    try {
      this.offMeta?.();
    } catch {
      // ignore
    }
    this.offMeta = null;
  }

  async accept() {
    if (!this.selectedId) {
      return;
    }
    this.busy = true;
    this.cdr.markForCheck();
    try {
      await this.facade.acceptTicket(this.selectedId);
    } catch (e: any) {
      this.err = e?.message || 'Falha ao assumir o atendimento';
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  statusLabel(status: string | undefined): string {
    switch (status) {
      case 'queued':
        return 'Na fila';
      case 'active':
        return 'Em atendimento';
      case 'closed':
        return 'Encerrado';
      default:
        return status || '—';
    }
  }

  laneLabel(lane: AdminQueueRow['lane']): string {
    return lane === 'queued' ? 'Aguardando' : 'Com você';
  }

  setQuery(value: string) {
    this.query = value ?? '';
  }

  get activeRows(): AdminQueueRow[] {
    return this.filteredRows.filter((row) => row.lane === 'active');
  }

  get queuedRows(): AdminQueueRow[] {
    return this.filteredRows.filter((row) => row.lane === 'queued');
  }

  get totalRows(): number {
    return this.workload.length;
  }

  get filteredRows(): AdminQueueRow[] {
    const term = this.query.trim().toLowerCase();
    if (!term) {
      return this.workload;
    }
    return this.workload.filter((row) => row.clienteLabel.toLowerCase().includes(term));
  }

  get hasFilteredRows(): boolean {
    return this.filteredRows.length > 0;
  }

  async finalizar() {
    if (!this.selectedId || !this.meta) {
      return;
    }
    this.busy = true;
    this.cdr.markForCheck();
    try {
      await this.facade.closeTicket(this.selectedId, this.meta.clienteUid);
      this.clearMeta();
      this.selectedId = null;
      this.meta = null;
    } catch (e: any) {
      this.err = e?.message || 'Falha ao encerrar';
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  private describeWorkloadError(error: unknown): string {
    const code = ((error as any)?.code || '').toString().toLowerCase();
    const msg = ((error as any)?.message || '').toString();
    if (code.includes('permission') || msg.toLowerCase().includes('permission_denied')) {
      return 'Sem permissão para ler a fila do chat. Faça login novamente e confirme perfil admin.';
    }
    if (msg) {
      return `Falha ao carregar fila em tempo real: ${msg}`;
    }
    return 'Falha ao carregar fila em tempo real.';
  }
}
