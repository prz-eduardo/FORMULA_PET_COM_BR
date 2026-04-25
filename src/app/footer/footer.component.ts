import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CookiePreferencesService } from '../services/cookie-preferences.service';
import { LOJA_IDENTIDADE, LOJA_MAPA_URL } from '../constants/loja-public';

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
    name: LOJA_IDENTIDADE.marca.nome,
    tagline: LOJA_IDENTIDADE.marca.tagline,
    description: LOJA_IDENTIDADE.marca.descricao,
    logo: LOJA_IDENTIDADE.marca.logoPath,
    legal: [] as string[],
  };

  readonly phone = LOJA_IDENTIDADE.contato.telefone;

  readonly hours = LOJA_IDENTIDADE.contato.horarioFuncionamento;

  readonly socials = LOJA_IDENTIDADE.social.links;

  readonly addresses: AddressBlock[] = [
    {
      lines: [`${LOJA_IDENTIDADE.endereco.linha1}`, `CEP ${LOJA_IDENTIDADE.endereco.cep}`],
    },
  ];

  readonly mapUrl = LOJA_MAPA_URL;

  openCookiePreferences(e: Event): void {
    e.preventDefault();
    this.cookies.openPreferencesPanel();
  }
}
