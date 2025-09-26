import { Component } from '@angular/core';
import { NavmenuComponent } from '../../navmenu/navmenu.component';
import {FooterComponent} from '../../footer/footer.component';

@Component({
  selector: 'app-sobre-nos',
  standalone: true,
  imports: [NavmenuComponent, FooterComponent],
  templateUrl: './sobre-nos.component.html',
  styleUrls: ['./sobre-nos.component.scss']
})
export class SobreNosComponent {

}
