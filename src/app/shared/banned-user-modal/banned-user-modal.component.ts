import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BannedUserModalService } from '../../services/banned-user-modal.service';
import { MARCA_NOME } from '../../constants/loja-public';

export const BANNED_USER_IMAGE_URL =
  'https://i.pinimg.com/474x/2f/c5/42/2fc5429cc937124e13e1b4ff059bc1c5.jpg';

@Component({
  selector: 'app-banned-user-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './banned-user-modal.component.html',
  styleUrls: ['./banned-user-modal.component.scss'],
})
export class BannedUserModalComponent {
  readonly imageUrl = BANNED_USER_IMAGE_URL;
  readonly marcaNome = MARCA_NOME;

  constructor(public ban: BannedUserModalService) {}

  close(): void {
    this.ban.hide();
  }
}
