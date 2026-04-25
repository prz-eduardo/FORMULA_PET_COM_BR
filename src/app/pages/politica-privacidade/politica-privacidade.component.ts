import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-politica-privacidade',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './politica-privacidade.component.html',
  styleUrls: ['./politica-privacidade.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PoliticaPrivacidadeComponent {}
