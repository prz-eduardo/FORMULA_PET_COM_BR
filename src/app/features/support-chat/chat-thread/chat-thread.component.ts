import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostBinding,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
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
export class ChatThreadComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) ticketId!: string;
  @Input({ required: true }) mode!: SupportChatMode;

  /** Tema escuro alinhado à área do cliente. */
  @HostBinding('class.theme-embed')
  get themeEmbed(): boolean {
    return this.mode === 'cliente';
  }

  @ViewChild('logContainer') logContainer?: ElementRef<HTMLElement>;

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
    await this.attachMessages();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['ticketId'] && !changes['ticketId'].firstChange) {
      void this.attachMessages();
    }
  }

  ngOnDestroy() {
    this.detachMessages();
  }

  private detachMessages() {
    try {
      this.offMessages?.();
    } catch {
      // ignore
    }
    this.offMessages = null;
  }

  private async attachMessages() {
    this.detachMessages();
    this.messages = [];
    this.err = '';
    this.cdr.markForCheck();
    try {
      await this.identity.ensureFirebaseForChat();
    } catch (e: any) {
      this.err = e?.message || 'Não foi possível preparar o chat';
      this.cdr.markForCheck();
      return;
    }
    if (!this.ticketId) {
      return;
    }
    this.offMessages = this.facade.subscribeMessages(this.ticketId, (list) => {
      this.messages = list;
      this.cdr.markForCheck();
      queueMicrotask(() => this.scrollLogToBottom());
    });
  }

  private scrollLogToBottom() {
    const el = this.logContainer?.nativeElement;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
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
      queueMicrotask(() => this.scrollLogToBottom());
    }
  }
}
