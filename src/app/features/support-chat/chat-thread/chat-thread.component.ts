import {
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupportChatMode, SupportMessage } from '../support.models';
import { SupportTicketFacadeService } from '../support-ticket-facade.service';
import { SupportChatIdentityService } from '../support-chat-identity.service';

@Component({
  selector: 'app-chat-thread',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-thread.component.html',
  styleUrls: ['./chat-thread.component.scss'],
})
export class ChatThreadComponent implements OnInit, OnDestroy {
  @Input({ required: true }) ticketId!: string;
  @Input({ required: true }) mode!: SupportChatMode;

  messages: SupportMessage[] = [];
  draft = '';
  sending = false;
  err = '';

  private offMessages: (() => void) | null = null;

  constructor(
    private facade: SupportTicketFacadeService,
    private identity: SupportChatIdentityService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    try {
      await this.identity.ensureFirebaseForChat();
    } catch (e: any) {
      this.err = e?.message || 'Não foi possível preparar o chat';
      this.cdr.markForCheck();
      return;
    }
    this.offMessages = this.facade.subscribeMessages(this.ticketId, (list) => {
      this.messages = list;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy() {
    try {
      this.offMessages?.();
    } catch {
      // ignore
    }
  }

  trackById(_: number, m: SupportMessage) {
    return m.id;
  }

  async send() {
    this.err = '';
    this.sending = true;
    this.cdr.markForCheck();
    try {
      await this.facade.sendMessage(this.mode, this.ticketId, this.draft);
      this.draft = '';
    } catch (e: any) {
      this.err = e?.message || 'Falha ao enviar';
    } finally {
      this.sending = false;
      this.cdr.markForCheck();
    }
  }
}
