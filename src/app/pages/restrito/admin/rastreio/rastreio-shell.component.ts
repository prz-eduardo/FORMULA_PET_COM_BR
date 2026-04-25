import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-rastreio-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './rastreio-shell.component.html',
  styleUrls: ['./rastreio-shell.component.scss'],
})
export class RastreioShellComponent {}
