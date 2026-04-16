import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LojaComponent } from './loja.component';

@NgModule({
  imports: [CommonModule, LojaComponent, RouterModule.forChild([{ path: '', component: LojaComponent }])],
})
export class LojaModule {}