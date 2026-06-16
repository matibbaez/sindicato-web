import { Component, inject, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ReclamosService, IReclamo } from '../../services/reclamos.service';
import { UsersService } from '../../services/users.service';
import { AuthService } from '../../services/auth.service';
import { NotificacionService } from '../../services/notificacion';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dashboard.html',
  // Borramos la referencia al SCSS viejo
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDashboardComponent implements OnInit {

  private reclamosService = inject(ReclamosService);
  private usersService = inject(UsersService);
  public authService = inject(AuthService);
  private notificacionService = inject(NotificacionService);
  private router = inject(Router);

  ordenDescendente = signal(true);

  // Estado UI
  isLoading = signal(true);
  fechaHoy = new Date();
  eliminandoId = signal<string | null>(null);

  // --- FILTROS Y BÚSQUEDA ---
  filtroTexto = signal('');
  filtroEstado = signal('');
  filtroRol = signal('');

  // Datos Crudos
  private reclamos = signal<IReclamo[]>([]);
  private usuariosTotal = signal(0);
  private usuariosPendientes = signal(0);

  // --- LÓGICA COMPUTADA ---

  // 1. KPI Metrics
  stats = computed(() => {
    const total = this.reclamos().length;
    const nuevos = this.reclamos().filter(r => ['Enviado', 'Recepcionado'].includes(r.estado)).length;
    
    return {
      reclamosTotales: total,
      reclamosNuevos: nuevos,
      usuariosTotales: this.usuariosTotal(),
      pendientesAprobacion: this.usuariosPendientes()
    };
  });

  // 2. LISTA FILTRADA
  reclamosFiltrados = computed(() => {
    const data = this.reclamos();
    const txt = this.filtroTexto().toLowerCase();
    const estado = this.filtroEstado();
    const rol = this.filtroRol();

    return data
      .filter(r => {
        const matchesText = txt 
          ? (r.nombre.toLowerCase().includes(txt) || 
             r.dni.includes(txt) || 
             r.codigo_seguimiento.toLowerCase().includes(txt))
          : true;
        
        const matchesEstado = estado ? r.estado === estado : true;
        const matchesRol = rol ? r.rol_victima === rol : true;

        return matchesText && matchesEstado && matchesRol;
      })
      .sort((a, b) => {
        const fechaA = new Date(a.fecha_creacion).getTime();
        const fechaB = new Date(b.fecha_creacion).getTime();
        return this.ordenDescendente() ? fechaB - fechaA : fechaA - fechaB;
      });
  });

  ngOnInit() {
    this.cargarDatos();
  }

  cargarDatos() {
    this.isLoading.set(true);

    // 1. Cargar reclamos (Todos los roles permitidos en esta vista ven esto)
    const p1 = new Promise<void>((resolve) => {
      this.reclamosService.findAll().subscribe({
        next: (data) => {
          this.reclamos.set(data as IReclamo[]);
          resolve();
        },
        error: () => resolve()
      });
    });

    // 2. Cargar usuarios (SOLO para administradores)
    const p2 = new Promise<void>((resolve) => {
      if (!this.authService.esAdmin) {
        resolve(); // Si es sindicato, no gastamos red ni tiempo en buscar usuarios
        return;
      }
      
      this.usersService.getAll().subscribe({
        next: (users) => {
          this.usuariosTotal.set(users.length);
          this.usuariosPendientes.set(users.filter(u => !u.isApproved).length);
          resolve();
        },
        error: () => resolve()
      });
    });

    Promise.all([p1, p2]).then(() => this.isLoading.set(false));
  }

  // --- ACCIONES ---
  alternarOrden() {
    this.ordenDescendente.update(val => !val);
  }
  
  irAEquipo() { 
    this.router.navigate(['/mi-equipo']); 
  }
  
  verDetalle(id: string) { 
    this.router.navigate(['/reclamo', id]); 
  }

  // Reemplazar la función eliminarReclamo existente por esta:
  eliminarReclamo(id: string, event: Event) {
    event.stopPropagation(); 

    Swal.fire({
      title: '¿Eliminar este expediente?',
      text: 'Esta acción borrará todos los datos del reclamo permanentemente y no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#334155',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      customClass: {
        popup: 'premium-modal-popup'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        
        // Activamos el estado de carga para este ID específico
        this.eliminandoId.set(id);

        this.reclamosService.eliminarReclamo(id).subscribe({
          next: () => {
            this.eliminandoId.set(null); // Apagamos el estado de carga
            this.notificacionService.showSuccess('Reclamo eliminado correctamente.');
            this.cargarDatos(); 
          },
          error: (err) => {
            this.eliminandoId.set(null); // Apagamos el estado de carga en caso de error
            this.notificacionService.showError('Error al eliminar el reclamo.');
            console.error(err);
          }
        });
      }
    });
  }

  // --- EVENTOS FILTROS ---
  aplicarBusqueda(e: Event) { this.filtroTexto.set((e.target as HTMLInputElement).value); }
  cambiarEstado(e: Event) { this.filtroEstado.set((e.target as HTMLSelectElement).value); }
  cambiarRol(e: Event) { this.filtroRol.set((e.target as HTMLSelectElement).value); }
}