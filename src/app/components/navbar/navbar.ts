import { Component, inject, HostListener, OnInit } from '@angular/core'; 
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { filter } from 'rxjs/operators'; 
import Swal from 'sweetalert2';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html', 
  styleUrl: './navbar.scss'
})
export class NavbarComponent implements OnInit {
  
  public authService = inject(AuthService);
  private router = inject(Router);
  
  menuAbierto = false;
  isScrolled = false; 
  isHome = true;

  toggleMenu() {
    this.menuAbierto = !this.menuAbierto;
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isScrolled = window.scrollY > 20;
  }

  ngOnInit() {
    this.checkUrl();
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.checkUrl();
    });
  }

  checkUrl() {
    const url = this.router.url;
    // Esto asegura que tanto en la Home como en Productores el navbar inicie transparente
    this.isHome = url === '/' || url.includes('productores'); 
  }

  // 👇 CERRAR SESIÓN PREMIUM (100% Tailwind)
  cerrarSesion() {
    this.menuAbierto = false;

    Swal.fire({
      html: `
        <div class="flex flex-col items-center pt-2">
          <div class="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-5 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
            <svg class="w-7 h-7 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
          <h3 class="text-xl font-bold text-white mb-2 tracking-tight">¿Cerrar Sesión?</h3>
          <p class="text-slate-400 text-sm mb-2">Tu sesión se cerrará de forma segura.</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Sí, Salir',
      cancelButtonText: 'Cancelar',
      buttonsStyling: false, // Apagamos los estilos feos por defecto de Swal
      customClass: {
        // Contenedor principal del modal
        popup: '!bg-[#0f172a] !border !border-slate-800 !rounded-3xl',
        // Contenedor de las acciones (botones)
        actions: '!mt-6 !gap-3 !w-full !px-6 !pb-6',
        // Botón de confirmar (Rojo suave)
        confirmButton: 'w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-semibold py-3 rounded-xl transition-colors',
        // Botón de cancelar (Gris oscuro)
        cancelButton: 'w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 rounded-xl transition-colors'
      },
      width: '360px',
      background: 'transparent',
      backdrop: `
        rgba(3, 7, 18, 0.8)
        backdrop-filter: blur(8px)
      `
    }).then((result) => {
      if (result.isConfirmed) {
        this.authService.logout();
      }
    });
  }

  cerrarMenu() {
    this.menuAbierto = false;
  }
}