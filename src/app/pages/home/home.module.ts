import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HomeComponent } from './home.component';

@NgModule({
  imports: [CommonModule, HomeComponent, RouterModule.forChild([{ path: '', component: HomeComponent }])],
})
export class HomeModule {}