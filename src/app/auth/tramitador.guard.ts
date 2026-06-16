import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NotificacionService } from '../services/notificacion';

export const tramitadorGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const notificacion = inject(NotificacionService);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  // Permitir el acceso únicamente al rol de Tramitador
  if (authService.esTramitador) {
    return true;
  }

  // Si es un Administrador o Sindicato, se redirige a su respectivo panel
  notificacion.showError('Acceso denegado. Zona exclusiva de Tramitadores.');
  
  if (authService.esAdmin) {
    router.navigate(['/admin-dashboard']);
  } else {
    router.navigate(['/dashboard']);
  }
  
  return false;
};