import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationsBellComponent } from '../shared/notifications-bell/notifications-bell.component';

@Component({
  selector: 'app-admin-notification',
  standalone: true,
  imports: [CommonModule, NotificationsBellComponent],
  template: `<app-notifications-bell audience="admin"></app-notifications-bell>`,
  styles: [':host { display: inline-block; }'],
})
export class AdminNotificationComponent {}
