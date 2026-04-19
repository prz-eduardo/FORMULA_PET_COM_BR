import { Component } from '@angular/core';
import { ButtonDirective, ButtonComponent } from '../../../../shared/button';

@Component({
  selector: 'app-guia-restritos',
  standalone: true,
  imports: [ButtonDirective, ButtonComponent],
  templateUrl: './guia-restritos.component.html',
  styleUrls: ['./guia-restritos.component.scss']
})
export class GuiaRestritosComponent {

}
