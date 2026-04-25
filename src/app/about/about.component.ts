import { Component } from '@angular/core';
import { MARCA_NOME } from '../constants/loja-public';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [],
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent {
  readonly marcaNome = MARCA_NOME;
}
