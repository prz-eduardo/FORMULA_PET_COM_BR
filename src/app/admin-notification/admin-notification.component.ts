// Angular standalone patch: garantir detecção correta pelo compilador
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminNotificationService } from './admin-notification.service';

@Component({
  selector: 'app-admin-notification',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-notification.component.html',
  styleUrls: ['./admin-notification.component.scss']
})
export class AdminNotificationComponent implements OnInit, OnDestroy {
  notifications: any[] = [];
  unreadCount = 0;
  private sub: any;

  constructor(private notificationService: AdminNotificationService) {}

  ngOnInit() {
    this.sub = this.notificationService.notifications$.subscribe((data) => {
      this.notifications = data;
      this.unreadCount = data.filter(n => !n.read).length;
    });
  }

  ngOnDestroy() {
    if (this.sub) this.sub.unsubscribe();
  }

  markAllAsRead() {
    this.notificationService.markAllAsRead();
  }
}
