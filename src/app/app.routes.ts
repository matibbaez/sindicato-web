import { Routes } from '@angular/router';
import { InicioComponent } from './pages/inicio/inicio';
import { IniciarReclamoComponent } from './pages/iniciar-reclamo/iniciar-reclamo';
import { ConsultarTramiteComponent } from './pages/consultar-tramite/consultar-tramite';
import { LoginComponent } from './pages/login/login';
import { AdminDashboardComponent } from './pages/admin-dashboard/admin-dashboard';
import { MiEquipoComponent } from './pages/mi-equipo/mi-equipo';
import { ExitoComponent } from './pages/exito/exito';
import { CuentaPendienteComponent } from './pages/cuenta-pendiente/cuenta-pendiente';
import { DetalleReclamoComponent } from './pages/dashboard/detalle-reclamo/detalle-reclamo';
import { LegalesComponent } from './pages/legales/legales';
import { MiPerfilComponent } from './pages/mi-perfil/mi-perfil';

// COMPONENTES DE DASHBOARDS
import { SindicatoDashboardComponent } from './pages/sindicato-dashboard/sindicato-dashboard';
import { TramitadorDashboardComponent } from './pages/tramitador-dashboard/tramitador-dashboard';

// GUARDS
import { authGuard } from './auth/auth-guard';
import { adminGuard } from './auth/admin.guard';
import { sindicatoGuard } from './auth/sindicato.guard'; // 👇 NUEVO IMPORT
import { tramitadorGuard } from './auth/tramitador.guard'; // 👇 NUEVO IMPORT

export const routes: Routes = [
  { 
    path: '', 
    component: InicioComponent, 
    pathMatch: 'full',
    data: { animation: 'InicioPage' }
  },
  { 
    path: 'iniciar-reclamo', 
    component: IniciarReclamoComponent,
    data: { animation: 'IniciarPage' } 
  },
  { 
    path: 'consultar-tramite', 
    component: ConsultarTramiteComponent,
    data: { animation: 'ConsultarPage' } 
  },
  { 
    path: 'login', 
    component: LoginComponent,
    data: { animation: 'LoginPage' } 
  },
  { 
    path: 'admin-dashboard', 
    component: AdminDashboardComponent, 
    canActivate: [adminGuard], 
    data: { animation: 'AdminPage' } 
  },
  { 
    path: 'mi-equipo', 
    component: MiEquipoComponent, 
    canActivate: [adminGuard], 
  },
  { 
    path: 'mi-perfil', 
    component: MiPerfilComponent, 
    canActivate: [authGuard], 
    data: { animation: 'PerfilPage' } 
  },
  
  // PANEL DEL SINDICATO: Ahora protegido por el sindicatoGuard
  { 
    path: 'dashboard', 
    component: SindicatoDashboardComponent, 
    canActivate: [sindicatoGuard], // 👈 CAMBIADO
    data: { animation: 'DashboardPage' } 
  },

  // PANEL DEL TRAMITADOR: Ahora protegido por el tramitadorGuard
  { 
    path: 'mis-casos', 
    component: TramitadorDashboardComponent, 
    canActivate: [tramitadorGuard], // 👈 CAMBIADO
    data: { animation: 'TramitadorPage' } 
  },
  
  { 
    path: 'reclamo/:id', 
    component: DetalleReclamoComponent,
    canActivate: [authGuard], 
    data: { animation: 'DetallePage' } 
  },
  { 
    path: 'exito', 
    component: ExitoComponent,
    data: { animation: 'ExitoPage' } 
  },
  { 
    path: 'legales', 
    component: LegalesComponent 
  },
  { 
    path: 'cuenta-pendiente', 
    component: CuentaPendienteComponent,
    data: { animation: 'PendientePage' } 
  },
  { 
    path: '**', 
    redirectTo: '' 
  } 
];