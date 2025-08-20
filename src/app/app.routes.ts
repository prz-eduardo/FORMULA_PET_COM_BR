import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/restrito/login/login.component';
import { AdminComponent } from './pages/restrito/admin/admin.component';
import { ProdutoComponent } from './pages/restrito/admin/produto/produto.component';
import { ProdutoListComponent } from './pages/restrito/admin/lista-produtos/lista-produtos.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },               // Página pública (home)
  { path: 'restrito', redirectTo: 'restrito/login', pathMatch: 'full' },
  { path: 'restrito/login', component: LoginComponent },
  { path: 'restrito/admin', component: AdminComponent, canActivate: [authGuard] },
  { path: 'restrito/produto', component: ProdutoComponent, canActivate: [authGuard] },
  { path: 'restrito/lista-produtos', component: ProdutoListComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }                        // Redireciona qualquer rota inválida pra home
];
