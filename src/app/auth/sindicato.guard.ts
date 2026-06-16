import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NotificacionService } from '../services/notificacion';

export const sindicatoGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const notificacion = inject(NotificacionService);

  // 1. Chequeamos si está logueado
  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  // 2. Permitimos el acceso ÚNICAMENTE al rol de Sindicato
  if (authService.esSindicato) {
    return true;
  }

  // 3. Si es otro rol intentando colarse, lo mandamos a su zona correspondiente
  notificacion.showError('Acceso denegado. Zona exclusiva del Sindicato.');
  
  if (authService.esAdmin) {
    router.navigate(['/admin-dashboard']);
  } else if (authService.esTramitador) {
    router.navigate(['/mis-casos']);
  } else {
    router.navigate(['/']); 
  }
  
  return false;
};