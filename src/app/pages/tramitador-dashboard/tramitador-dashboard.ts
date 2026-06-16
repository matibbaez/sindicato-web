import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ReclamosService, IReclamo } from '../../services/reclamos.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-tramitador-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './tramitador-dashboard.html'
})
export class TramitadorDashboardComponent implements OnInit {
  
  private reclamosService = inject(ReclamosService);
  public authService = inject(AuthService);
  private router = inject(Router);

  reclamos: IReclamo[] = [];
  isLoading = true;

  // --- FILTROS ---
  searchTerm = '';
  estadoFiltro = 'Todos';
  rolFiltro = 'Todos';

  // --- MÉTRICAS ---
  stats = {
    total: 0,
    activos: 0,
    finalizados: 0
  };

  ngOnInit() {
    this.cargarMisCasos();
  }

  cargarMisCasos() {
    this.isLoading = true;
    
    // 👇 Usamos tu método específico del service
    this.reclamosService.obtenerMisSiniestros().subscribe({
      next: (data) => {
        this.reclamos = data;
        this.calcularEstadisticas(data);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error cargando expedientes propios', err);
        this.isLoading = false;
      }
    });
  }

  calcularEstadisticas(data: IReclamo[]) {
    this.stats.total = data.length;
    this.stats.finalizados = data.filter(r => r.estado === 'Indemnizado' || r.estado === 'Rechazado').length;
    this.stats.activos = this.stats.total - this.stats.finalizados;
  }

  get reclamosFiltrados() {
    return this.reclamos.filter(r => {
      const termino = this.searchTerm.toLowerCase();
      const coincideTexto = (r.nombre?.toLowerCase() || '').includes(termino) ||
                            (r.dni || '').includes(termino) ||
                            (r.codigo_seguimiento?.toLowerCase() || '').includes(termino);
      
      const coincideEstado = this.estadoFiltro === 'Todos' || r.estado === this.estadoFiltro;
      const coincideRol = this.rolFiltro === 'Todos' || r.rol_victima === this.rolFiltro;

      return coincideTexto && coincideEstado && coincideRol;
    });
  }

  verDetalle(id: string) {
    this.router.navigate(['/reclamo', id]); 
  }
}