import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-listing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-listing.component.html',
  styleUrls: ['./admin-listing.component.scss']
})
export class AdminListingComponent {
  @Input() loading: boolean = false;
}
