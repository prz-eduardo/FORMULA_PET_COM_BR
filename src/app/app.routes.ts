import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/restrito/login/login.component';
import { AdminComponent } from './pages/restrito/admin/admin.component';
import { ProdutoComponent } from './pages/restrito/admin/produto/produto.component';
import { ListaProdutosComponent } from './pages/restrito/admin/lista-produtos/lista-produtos.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },// Página pública (home)
  { path: 'sobre-nos', loadComponent: () => import('./pages/sobre-nos/sobre-nos.component').then(m => m.SobreNosComponent) },
  { 
    path: 'meus-pedidos', 
    loadComponent: () => import('./pages/meus-pedidos/meus-pedidos.component').then(m => m.MeusPedidosComponent),
    children: [
      {
        path: 'consultar-pedidos',
        outlet: 'modal',
        loadComponent: () => import('./pages/restrito/area-cliente/consultar-pedidos/consultar-pedidos.component').then(m => m.ConsultarPedidosComponent)
      }
    ]
  },
  { path: 'restrito', redirectTo: 'restrito/login', pathMatch: 'full' },
  { path: 'restrito/login', component: LoginComponent },
  { path: 'restrito/admin', component: AdminComponent, canActivate: [authGuard] },
  { path: 'restrito/produto', component: ProdutoComponent, canActivate: [authGuard] },
  { path: 'restrito/lista-produtos', component: ListaProdutosComponent, canActivate: [authGuard] },
  { path: 'restrito/usuarios', loadComponent: () => import('./pages/restrito/usuarios/usuarios.component').then(m => m.UsuariosComponent), canActivate: [authGuard] },
  { 
    path: 'area-cliente', 
    loadComponent: () => import('./pages/restrito/area-cliente/area-cliente.component').then(m => m.AreaClienteComponent),
    children: [
      {
        path: 'consultar-pedidos',
        outlet: 'modal',
        loadComponent: () => import('./pages/restrito/area-cliente/consultar-pedidos/consultar-pedidos.component').then(m => m.ConsultarPedidosComponent)
      }
    ]
  },
  { path: 'novo-pet', loadComponent: () => import('./pages/novo-pet/novo-pet.component').then(m => m.NovoPetComponent) },
  { path: 'editar-pet/:id', loadComponent: () => import('./pages/novo-pet/novo-pet.component').then(m => m.NovoPetComponent) },
  { path: 'area-vet', loadComponent: () => import('./pages/restrito/area-vet/area-vet.component').then(m => m.AreaVetComponent)},
  { path: 'gerar-receita', loadComponent: () => import('./pages/restrito/area-vet/gerar-receita/gerar-receita.component').then(m => m.GerarReceitaComponent)},
  { path: 'historico-receitas', loadComponent: () => import('./pages/restrito/area-vet/historico-receitas/historico-receitas.component').then(m => m.HistoricoReceitasComponent)},
  { path: 'historico-receitas/:id', loadComponent: () => import('./pages/restrito/area-vet/receita-detalhe/receita-detalhe.component').then(m => m.ReceitaDetalheComponent)},
  { path: 'pacientes', loadComponent: () => import('./pages/restrito/area-vet/pacientes/pacientes.component').then(m => m.PacientesComponent)},
  { path: 'pacientes/:petId', loadComponent: () => import('./pages/restrito/area-vet/paciente-detalhe/paciente-detalhe.component').then(m => m.PacienteDetalheComponent)},
  { path: 'meus-pets', loadComponent: () => import('./pages/meus-pets/meus-pets.component').then(m => m.MeusPetsComponent)},
  { path: 'editar-perfil', loadComponent: () => import('./pages/perfil/perfil.component').then(m => m.PerfilComponent)},
  {path: 'restrito/admin/guia-ativos', loadComponent: () => import('./pages/restrito/admin/guia-ativos/guia-ativos.component').then(m => m.GuiaAtivosAdminComponent), canActivate: [authGuard]},
  { path: '**', redirectTo: '' }                        // Redireciona qualquer rota inválida pra home
];
