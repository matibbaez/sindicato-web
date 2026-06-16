import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { CommonModule, Location, NgOptimizedImage } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

/* Services */
import { ReclamosService, IReclamo } from '../../../services/reclamos.service';
import { NotificacionService } from '../../../services/notificacion';
import { AuthService } from '../../../services/auth.service';
import { UsersService, IUser } from '../../../services/users.service';

@Component({
  selector: 'app-detalle-reclamo',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, FormsModule],
  templateUrl: './detalle-reclamo.html'
  // Eliminamos styleUrls porque borramos el .scss
})
export class DetalleReclamoComponent implements OnInit {

  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private reclamosService = inject(ReclamosService);
  private usersService = inject(UsersService);
  private notificacionService = inject(NotificacionService);
  public authService = inject(AuthService);

  // --- VARIABLES DE MENSAJES ---
  tabActual: 'publico' | 'interno' = 'publico'; 
  notaInternaTexto = ''; 
  guardandoNotaInterna = false;

  observacionTexto = '';
  guardandoObservacion = false;
  
  estadoEnActualizacion: string | null = null; 
  guardandoTramitador = false; 

  // --- ESTADO (SIGNALS) ---
  reclamo = signal<IReclamo | null>(null);
  isLoading = signal(true);
  editandoTramitador = signal(false);
  
  archivosDisponibles: any[] = [];
  tramitadores: IUser[] = [];
  tramitadorSeleccionado = '';

  galeriaFotos: string[] = [];
  cargandoFotos = false;

  // --- TIMELINE ---
  pasosTimeline = [
    { id: 'Enviado', label: 'Enviado' },
    { id: 'Recepcionado', label: 'Recepcionado' },
    { id: 'Iniciado', label: 'Iniciado' },
    { id: 'Negociacion', label: 'Negociación' },
    { id: 'Indemnizando', label: 'Cobro' },
    { id: 'Indemnizado', label: 'Finalizado' }
  ];

  indiceProgreso = computed(() => {
    const r = this.reclamo();
    if (!r) return 0;
    if (r.estado === 'Rechazado') return -1;
    return this.pasosTimeline.findIndex(p => p.id === r.estado);
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.volver(); return; }

    this.cargarReclamo(id);
    if (this.authService.esAdmin) this.cargarTramitadores();
  }

  cambiarTab(tab: 'publico' | 'interno') {
    this.tabActual = tab;
  }

  volver() {
    this.location.back();
  }

  private cargarReclamo(id: string): void {
    this.isLoading.set(true);
    this.reclamosService.getReclamoPorId(id)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (data) => {
          this.reclamo.set(data);
          this.syncDatos(data); 
          this.generarLegajo(data);

          if (data.path_fotos && data.path_fotos.length > 0) {
           this.cargarGaleria(data.id);
          }
        },
        error: () => {
          this.notificacionService.showError('Error al recuperar el expediente.');
          this.volver();
        }
      });
  }

  cargarGaleria(id: string) {
    this.cargandoFotos = true;
    this.reclamosService.obtenerGaleria(id).subscribe({
      next: (res) => {
        this.galeriaFotos = res.urls;
        this.cargandoFotos = false;
      },
      error: () => {
        this.cargandoFotos = false;
        console.error('Error cargando galería');
      }
    });
  }

  private syncDatos(data: IReclamo): void {
    this.observacionTexto = ''; 
    if (data.tramitador) {
      this.tramitadorSeleccionado = data.tramitador.id;
    } else {
      this.tramitadorSeleccionado = '';
    }
    this.editandoTramitador.set(false);
  }

  // --- GENERACIÓN DEL LEGAJO DIGITAL ---
  private generarLegajo(r: IReclamo): void {
    // Mapeamos las keys a los tipos de íconos que soporta el nuevo HTML
    const iconTypeMap: Record<string, string> = {
      dni: 'id', licencia: 'id', cedula: 'car', poliza: 'shield',
      denuncia: 'alert', fotos: 'file', medicos: 'medical',
      representacion: 'file', honorarios: 'file', 
      presupuesto: 'file', cbu: 'id', legal: 'shield', complementaria: 'file'
    };

    const propertyMap: Record<string, string> = {
        'cbu': 'path_cbu_archivo',
        'legal': 'path_denuncia_penal'
    };

    const esNoSeguro = r.tiene_seguro === false;
    const etiquetaPoliza = esNoSeguro ? 'Carta No Seguro' : 'Póliza';
    const subPoliza = esNoSeguro ? 'Declaración Jurada' : 'Seguro Vigente';

    const definiciones = [
      { key: 'dni', label: 'DNI', sub: 'Identidad' },
      { key: 'licencia', label: 'Licencia', sub: 'Conductor' },
      { key: 'cedula', label: 'Cédula', sub: 'Vehículo' },
      
      { key: 'poliza', label: etiquetaPoliza, sub: subPoliza },
      { key: 'denuncia', label: 'Denuncia', sub: 'Administrativa' },
      { key: 'presupuesto', label: 'Presupuesto', sub: 'Reparación' },
      { key: 'medicos', label: 'Médicos', sub: 'Certificados', alert: true },
      { key: 'cbu', label: 'Comp. CBU', sub: 'Bancario' },
      { key: 'legal', label: 'Denuncia Penal', sub: 'Judicial' },
      { key: 'complementaria', label: 'Doc. Extra', sub: 'Adicional' },

      { key: 'representacion', label: 'Poder', sub: 'Legal', highlight: true },
      { key: 'honorarios', label: 'Honorarios', sub: 'Convenio' }
    ];

    this.archivosDisponibles = [];

    definiciones.forEach(def => {
       const propName = propertyMap[def.key] || ('path_' + def.key);
       
       // @ts-ignore
       const rawValue = r[propName];

       if (!rawValue) return; 

       if (Array.isArray(rawValue)) {
          rawValue.forEach((pathItem, index) => {
             this.archivosDisponibles.push({
                key: def.key,
                label: `${def.label} (${index + 1})`,
                sub: def.sub,
                path: pathItem,
                isMultiple: true,
                index: index,
                iconType: (def.key === 'poliza' && esNoSeguro) ? 'file' : (iconTypeMap[def.key] || 'file'),
                highlight: def.highlight,
                alert: def.alert
             });
          });
       } 
       else if (typeof rawValue === 'string') {
          this.archivosDisponibles.push({
             ...def,
             path: rawValue,
             isMultiple: false,
             iconType: (def.key === 'poliza' && esNoSeguro) ? 'file' : (iconTypeMap[def.key] || 'file')
          });
       }
    });
  }

  private cargarTramitadores(): void {
    this.usersService.getTramitadores().subscribe(u => this.tramitadores = u);
  }

  abrirFoto(url: string) {
    window.open(url, '_blank');
  }

  // --- LÓGICA DE TRAMITADOR ---
  activarEdicion() { this.editandoTramitador.set(true); }
  
  cancelarEdicion() {
    this.editandoTramitador.set(false);
    const r = this.reclamo();
    if (r?.tramitador) {
      this.tramitadorSeleccionado = r.tramitador.id;
    } else {
      this.tramitadorSeleccionado = '';
    }
  }

  asignarAbogado() {
    const r = this.reclamo();
    if (!r || !this.tramitadorSeleccionado) return;

    this.guardandoTramitador = true; // Encendemos el spinner

    this.reclamosService.asignarTramitador(r.id, this.tramitadorSeleccionado).subscribe({
      next: res => {
        this.reclamo.set(res);
        this.editandoTramitador.set(false);
        this.guardandoTramitador = false; // Apagamos el spinner
        this.notificacionService.showSuccess('Abogado asignado al expediente.');
      },
      error: () => {
        this.guardandoTramitador = false; // Apagamos el spinner en caso de error
        this.notificacionService.showError('Error al asignar abogado.');
      }
    });
  }

  // 👇 NUEVO MÉTODO PARA QUITAR AL ABOGADO
  removerAbogado() {
    const r = this.reclamo();
    if (!r || !r.tramitador) return;

    Swal.fire({
      html: `
        <div class="flex flex-col items-center pt-2">
          <div class="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-5 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
            <svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 class="text-xl font-bold text-white mb-2 tracking-tight">¿Remover Abogado?</h3>
          <p class="text-slate-400 text-sm mb-2 text-center">El expediente volverá a quedar sin tramitador asignado.</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Sí, remover',
      cancelButtonText: 'Cancelar',
      buttonsStyling: false,
      customClass: {
        popup: '!bg-[#0f172a] !border !border-slate-800 !rounded-3xl',
        actions: '!mt-6 !gap-3 !w-full !px-6 !pb-6',
        confirmButton: 'w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-red-600/20',
        cancelButton: 'w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 rounded-xl transition-colors'
      },
      width: '360px',
      background: 'transparent',
      backdrop: `rgba(3, 7, 18, 0.8) backdrop-filter: blur(8px)`
    }).then(res => {
      if (res.isConfirmed) {
        
        // Enviamos 'null' o un string vacío al backend para desasignar
        this.reclamosService.asignarTramitador(r.id, null as any).subscribe({
          next: (updated) => {
            this.reclamo.set(updated);
            this.tramitadorSeleccionado = '';
            this.notificacionService.showSuccess('Abogado removido del caso.');
          },
          error: () => this.notificacionService.showError('Error al remover el abogado.')
        });

      }
    });
  }

  // --- LÓGICA DE ESTADOS ---
  cambiarEstado(nuevoEstado: string) {
    const r = this.reclamo();
    if (!r || r.estado === nuevoEstado) return;

    Swal.fire({
      html: `
        <div class="flex flex-col items-center pt-2">
          <div class="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-5 shadow-[0_0_20px_rgba(99,102,241,0.15)]">
            <svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <h3 class="text-xl font-bold text-white mb-2 tracking-tight">¿Cambiar Estado?</h3>
          <p class="text-slate-400 text-sm mb-2">El expediente pasará a la etapa de <strong class="text-indigo-300 font-semibold">${nuevoEstado}</strong>.</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Sí, actualizar',
      cancelButtonText: 'Cancelar',
      buttonsStyling: false,
      customClass: {
        popup: '!bg-[#0f172a] !border !border-slate-800 !rounded-3xl',
        actions: '!mt-6 !gap-3 !w-full !px-6 !pb-6',
        confirmButton: 'w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-indigo-600/20',
        cancelButton: 'w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 rounded-xl transition-colors'
      },
      width: '360px',
      background: 'transparent',
      backdrop: `
        rgba(3, 7, 18, 0.8)
        backdrop-filter: blur(8px)
      `
    }).then(res => {
      if (res.isConfirmed) {
        
        // 👇 PRENDEMOS EL SPINNER
        this.estadoEnActualizacion = nuevoEstado;
        
        const tramitadorActual = r.tramitador; 
        this.reclamosService.actualizarEstado(r.id, nuevoEstado).subscribe({
          next: (updated) => {
            if (!updated.tramitador && tramitadorActual) {
              updated.tramitador = tramitadorActual;
            }
            this.reclamo.set(updated);
            
            // 👇 APAGAMOS EL SPINNER Y AVISAMOS ÉXITO
            this.estadoEnActualizacion = null;
            this.notificacionService.showSuccess(`Estado actualizado a ${nuevoEstado}`);
          },
          error: () => {
            // 👇 APAGAMOS EL SPINNER SI HAY ERROR
            this.estadoEnActualizacion = null;
            this.notificacionService.showError('Error al actualizar estado.');
          }
        });
      }
    });
  }

  guardarNotaInterna() {
    const r = this.reclamo();
    if (!r || !this.notaInternaTexto.trim()) return;

    this.guardandoNotaInterna = true;
    
    this.reclamosService.agregarNotaInterna(r.id, this.notaInternaTexto).subscribe({
      next: (res) => {
        this.guardandoNotaInterna = false;
        this.notaInternaTexto = ''; 
        const currentTramitador = r.tramitador;
        if (!res.tramitador && currentTramitador) res.tramitador = currentTramitador;
        this.reclamo.set(res);
        this.notificacionService.showSuccess('Nota interna guardada.');
      },
      error: () => {
        this.guardandoNotaInterna = false;
        this.notificacionService.showError('Error al guardar nota.');
      }
    });
  }

  guardarObservacion() {
    const r = this.reclamo();
    if (!r || !this.observacionTexto.trim()) return;

    this.guardandoObservacion = true;
    
    this.reclamosService.agregarMensaje(r.id, this.observacionTexto).subscribe({
      next: (res) => {
        this.guardandoObservacion = false;
        this.observacionTexto = ''; 
        const currentTramitador = r.tramitador;
        if (!res.tramitador && currentTramitador) res.tramitador = currentTramitador;
        this.reclamo.set(res); 
      },
      error: () => {
        this.guardandoObservacion = false;
        this.notificacionService.showError('Error al enviar el mensaje.');
      }
    });
  }

  // --- UTILIDADES ---
  contactarWhatsApp() {
    const r = this.reclamo();
    if (!r?.telefono) return;
    const tel = r.telefono.replace(/\D/g, '');
    const msg = `Hola ${r.nombre}, te contacto del Sindicato de Motos por el expediente #${r.codigo_seguimiento}.`;
    window.open(`https://wa.me/549${tel}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  verArchivo(doc: any) {
    const r = this.reclamo();
    if (!r) return;
    
    const nuevaVentana = window.open('', '_blank');
    
    // HTML y CSS Premium Inyectado en crudo
    const htmlCarga = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <title>Desencriptando Documento...</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          body {
            margin: 0;
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            background-color: #030712;
            font-family: 'Inter', sans-serif;
            color: #f8fafc;
          }
          .icon-container {
            width: 72px;
            height: 72px;
            border-radius: 20px;
            background: rgba(99, 102, 241, 0.1);
            border: 1px solid rgba(99, 102, 241, 0.2);
            display: flex;
            justify-content: center;
            align-items: center;
            margin-bottom: 24px;
            box-shadow: 0 0 40px rgba(99, 102, 241, 0.15);
            position: relative;
          }
          .spinner {
            position: absolute;
            width: 100%;
            height: 100%;
            border: 3px solid transparent;
            border-top-color: #6366f1;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          .svg-icon {
            width: 32px;
            height: 32px;
            color: #818cf8;
          }
          h2 {
            margin: 0 0 8px 0;
            font-size: 22px;
            font-weight: 700;
            letter-spacing: -0.025em;
          }
          p {
            margin: 0;
            font-size: 14px;
            color: #94a3b8;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="icon-container">
          <div class="spinner"></div>
          <svg class="svg-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2>Acceso Seguro</h2>
        <p>Desencriptando el archivo solicitado, aguarde un instante...</p>
      </body>
      </html>
    `;
    
    if (nuevaVentana) { 
      nuevaVentana.document.write(htmlCarga); 
      nuevaVentana.document.close(); 
    }

    this.reclamosService.getArchivoUrl(r.id, doc.key, doc.index).subscribe({
      next: res => { 
        if (nuevaVentana) nuevaVentana.location.href = res.url; 
      },
      error: () => { 
        if (nuevaVentana) nuevaVentana.close();
        this.notificacionService.showError('No se pudo abrir el archivo.');
      }
    });
  }
}