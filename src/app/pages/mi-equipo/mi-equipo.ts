import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { UsersService, IUser } from '../../services/users.service';
import { NotificacionService } from '../../services/notificacion';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-mi-equipo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './mi-equipo.html'
})
export class MiEquipoComponent implements OnInit {

  private usersService = inject(UsersService);
  private notificacionService = inject(NotificacionService);
  public authService = inject(AuthService); 
  private fb = inject(FormBuilder);

  // Datos
  listaUsuarios: IUser[] = [];
  listaPendientes: IUser[] = [];
  
  // Estado UI
  isLoading = true;
  mostrarFormulario = false;
  activeTab: 'activos' | 'pendientes' = 'activos';
  searchTerm = '';

  // Estado de carga para botones
  guardandoUsuario = false; 
  usuarioEnAccion: string | null = null; // Para saber a qué usuario le estamos dando click en la tabla

  userForm: FormGroup = this.fb.group({
    nombre: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [
      Validators.required, 
      Validators.minLength(8),
      Validators.pattern(/^(?=.*[A-Z])(?=.*\d).*$/)
    ]],
    dni: [''],
    telefono: [''],
    role: ['Tramitador', Validators.required]
  });

  ngOnInit() {
    this.cargarDatos();
  }

  cargarDatos() {
    this.isLoading = true;
    
    this.usersService.getAll().subscribe({
      next: (data) => {
        // En este sistema, el Super Admin ve a TODOS (incluyendo a otros Admins) 
        // para que puedan gestionarse entre ellos.
        this.listaUsuarios = data.filter(u => u.isApproved);
        this.listaPendientes = data.filter(u => !u.isApproved);
        
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error(err);
        this.isLoading = false;
        this.notificacionService.showError('Error al cargar datos.');
      }
    });
  }

  get usuariosFiltrados() {
    return this.listaUsuarios.filter(u => 
      u.nombre.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  get pendientesFiltrados() {
    return this.listaPendientes.filter(u => 
      u.nombre.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  toggleFormulario() { this.mostrarFormulario = !this.mostrarFormulario; }
  cambiarTab(tab: 'activos' | 'pendientes') { this.activeTab = tab; }

  onSubmit() {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.guardandoUsuario = true; // Prendemos spinner
    
    this.usersService.create(this.userForm.value).subscribe({
      next: (nuevoUser) => {
        this.notificacionService.showSuccess(`Usuario ${nuevoUser.nombre} creado!`);
        // Como lo crea el Admin, ya nace aprobado
        this.listaUsuarios.push({ ...nuevoUser, isApproved: true }); 
        
        this.mostrarFormulario = false;
        this.userForm.reset({ role: 'Tramitador' });
        this.guardandoUsuario = false; // Apagamos spinner
      },
      error: () => {
        this.notificacionService.showError('Error al crear usuario.');
        this.guardandoUsuario = false; // Apagamos spinner
      }
    });
  }

  aprobarUsuario(user: IUser) {
    Swal.fire({
      html: `
        <div class="flex flex-col items-center pt-2">
          <div class="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-5 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 class="text-xl font-bold text-white mb-2 tracking-tight">¿Aprobar Acceso?</h3>
          <p class="text-slate-400 text-sm mb-2 text-center">Darás acceso a <strong class="text-emerald-300 font-semibold">${user.nombre}</strong> al sistema.</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Sí, Aprobar',
      cancelButtonText: 'Cancelar',
      buttonsStyling: false,
      customClass: {
        popup: '!bg-[#0f172a] !border !border-slate-800 !rounded-3xl',
        actions: '!mt-6 !gap-3 !w-full !px-6 !pb-6',
        confirmButton: 'w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-emerald-600/20',
        cancelButton: 'w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 rounded-xl transition-colors'
      },
      width: '360px',
      background: 'transparent',
      backdrop: `rgba(3, 7, 18, 0.8) backdrop-filter: blur(8px)`
    }).then((res) => {
      if (res.isConfirmed) {
        
        this.usuarioEnAccion = user.id; // Prendemos spinner en la tabla
        
        this.usersService.aprobarUsuario(user.id).subscribe({
          next: () => {
            this.listaPendientes = this.listaPendientes.filter(u => u.id !== user.id);
            this.listaUsuarios.push({ ...user, isApproved: true });
            this.usuarioEnAccion = null; // Apagamos spinner
            this.notificacionService.showSuccess('Usuario aprobado correctamente.');
          },
          error: () => {
            this.usuarioEnAccion = null;
            this.notificacionService.showError('Error al aprobar.');
          }
        });
      }
    });
  }

  actualizarRol(usuario: IUser, event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    const nuevoRol = selectElement.value;
    const rolAnterior = usuario.role;

    Swal.fire({
      html: `
        <div class="flex flex-col items-center pt-2">
          <div class="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-5 shadow-[0_0_20px_rgba(99,102,241,0.15)]">
            <svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <h3 class="text-xl font-bold text-white mb-2 tracking-tight">¿Cambiar Rol?</h3>
          <p class="text-slate-400 text-sm mb-2 text-center">Asignarás el rol de <strong class="text-indigo-300 font-semibold">${nuevoRol}</strong> a ${usuario.nombre}.</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Sí, Cambiar',
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
      backdrop: `rgba(3, 7, 18, 0.8) backdrop-filter: blur(8px)`
    }).then((res) => {
      if (res.isConfirmed) {
        
        this.usuarioEnAccion = usuario.id; // Prendemos spinner
        
        this.usersService.cambiarRol(usuario.id, nuevoRol).subscribe({
          next: () => {
            this.listaUsuarios = this.listaUsuarios.map(u => 
              u.id === usuario.id ? { ...u, role: nuevoRol } : u
            );
            this.listaPendientes = this.listaPendientes.map(u => 
              u.id === usuario.id ? { ...u, role: nuevoRol } : u
            );
            this.usuarioEnAccion = null; // Apagamos spinner
            this.notificacionService.showSuccess('Rol actualizado correctamente.');
          },
          error: (err: any) => {
            console.error(err);
            this.usuarioEnAccion = null; // Apagamos spinner
            this.notificacionService.showError('Error al cambiar el rol.');
            selectElement.value = rolAnterior;
          }
        });
      } else {
        selectElement.value = rolAnterior;
      }
    });
  }

  eliminarUsuario(user: IUser) {
    Swal.fire({
      html: `
        <div class="flex flex-col items-center pt-2">
          <div class="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-5 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
            <svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 class="text-xl font-bold text-white mb-2 tracking-tight">¿Eliminar Usuario?</h3>
          <p class="text-slate-400 text-sm mb-2 text-center">Eliminarás a <strong class="text-red-400 font-semibold">${user.nombre}</strong> permanentemente.</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Sí, Eliminar',
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
    }).then((res) => {
      if (res.isConfirmed) {
        
        this.usuarioEnAccion = user.id; // Prendemos spinner
        
        this.usersService.delete(user.id).subscribe({
          next: () => {
            this.listaUsuarios = this.listaUsuarios.filter(u => u.id !== user.id);
            this.listaPendientes = this.listaPendientes.filter(u => u.id !== user.id);
            this.usuarioEnAccion = null; // Apagamos spinner
            this.notificacionService.showSuccess('Usuario eliminado.');
          },
          error: () => {
            this.usuarioEnAccion = null; // Apagamos spinner
            this.notificacionService.showError('No se pudo eliminar.');
          }
        });
      }
    });
  }
}