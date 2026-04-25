import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CookiePreferencesService } from '../services/cookie-preferences.service';

type SocialKind = 'whatsapp' | 'instagram';

interface SocialLink {
  kind: SocialKind;
  label: string;
  href: string;
}

interface AddressBlock {
  title?: string;
  lines: string[];
}

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
  private readonly cookies = inject(CookiePreferencesService);
  readonly year = new Date().getFullYear();

  readonly company = {
    name: 'Fórmula Pet Curitiba',
    tagline: 'Farmácia de Manipulação Veterinária',
    description: 'Especializada em medicamentos, suplementos e cuidados para pets.',
    logo: '/imagens/image.png',
    legal: [
      'CNPJ: 41.325.057/0001-48',
      'REGISTRO MAPA Nº 002664-6',
    ],
  };

  readonly phone = {
    display: '(41) 3205-1910',
    tel: '+554132051910',
  };

  readonly hours = 'Segunda a Sexta · 9h às 18h';

  readonly socials: SocialLink[] = [
    {
      kind: 'whatsapp',
      label: 'WhatsApp',
      href: 'https://wa.me/554132051910?text=Oi%2C%20vim%20do%20site%20e%20gostaria%20de%20ajuda%20:)',
    },
    {
      kind: 'instagram',
      label: 'Instagram',
      href: 'https://www.instagram.com/',
    },
  ];

  readonly addresses: AddressBlock[] = [
    {
      lines: ['Rua Treze de Maio, 506 cj 4 - Centro', 'CEP 80510-030'],
    },
    {
      title: 'Estacionamento conveniado',
      lines: ['Rua Treze de Maio, 561 - Centro', 'CEP 80510-030'],
    },
  ];

  readonly mapUrl = 'https://maps.google.com/?q=Rua%20Treze%20de%20Maio%2C%20506%2C%20Curitiba';

  openCookiePreferences(e: Event): void {
    e.preventDefault();
    this.cookies.openPreferencesPanel();
  }
}
