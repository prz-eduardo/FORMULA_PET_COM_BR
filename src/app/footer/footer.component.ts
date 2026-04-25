import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CookiePreferencesService } from '../services/cookie-preferences.service';
import {
  LOJA_CEP,
  LOJA_ENDERECO_TEXTO,
  LOJA_MAPA_URL,
  MARCA_DESCRICAO,
  MARCA_LOGO_PATH,
  MARCA_NOME,
  MARCA_TAGLINE,
} from '../constants/loja-public';

type SocialKind = 'instagram';

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
    name: MARCA_NOME,
    tagline: MARCA_TAGLINE,
    description: MARCA_DESCRICAO,
    logo: MARCA_LOGO_PATH,
    legal: [] as string[],
  };

  /** Sem telefone público (demo anonimizado). */
  readonly phone: { display: string; tel: string } | null = null;

  readonly hours = 'Segunda a Sexta · 9h às 18h';

  readonly socials: SocialLink[] = [
    {
      kind: 'instagram',
      label: 'Instagram',
      href: 'https://www.instagram.com/',
    },
  ];

  readonly addresses: AddressBlock[] = [
    {
      lines: [`${LOJA_ENDERECO_TEXTO}`, `CEP ${LOJA_CEP}`],
    },
  ];

  readonly mapUrl = LOJA_MAPA_URL;

  openCookiePreferences(e: Event): void {
    e.preventDefault();
    this.cookies.openPreferencesPanel();
  }
}
