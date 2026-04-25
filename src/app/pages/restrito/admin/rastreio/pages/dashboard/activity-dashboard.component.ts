import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AdminApiService } from '../../../../../../services/admin-api.service';
import { ButtonDirective } from '../../../../../../shared/button';
import { RastreioDashboardDto } from '../../models/rastreio-dashboard.model';

@Component({
  selector: 'app-activity-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonDirective],
  templateUrl: './activity-dashboard.component.html',
  styleUrls: ['./activity-dashboard.component.scss'],
})
export class ActivityDashboardComponent implements OnInit {
  form: FormGroup;
  loading = signal(false);
  error = signal<string | null>(null);
  data = signal<RastreioDashboardDto | null>(null);

  constructor(private api: AdminApiService, private fb: FormBuilder) {
    this.form = this.fb.group({
      from: [''],
      to: [''],
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(null);
    const v = this.form.getRawValue();
    this.api
      .rastreioDashboard({
        from: v.from || undefined,
        to: v.to || undefined,
      })
      .subscribe({
        next: (d) => this.data.set(d),
        error: () => {
          this.data.set(null);
          this.error.set('Não foi possível carregar o resumo.');
        },
        complete: () => this.loading.set(false),
      });
  }

  apply() {
    this.load();
  }
}
