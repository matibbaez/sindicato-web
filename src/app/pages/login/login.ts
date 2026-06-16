import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { NotificacionService } from '../../services/notificacion';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.html'
})
export class LoginComponent implements OnInit {

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private notificacionService = inject(NotificacionService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isRegisterMode = false;
  isLoading = false;
  referralCode: string | null = null; 
  showPassword = false;

  // --- VALIDACIONES CUSTOM (REGEX) ---
  // DNI: Exactamente entre 7 y 9 números. Ni letras, ni puntos, ni espacios.
  private dniPattern = /^[0-9]{7,9}$/;
  
  // Teléfono: Entre 8 y 12 números. Nada más.
  private telefonoPattern = /^[0-9]{8,12}$/;
  
  // Nombre: Solo letras (incluye tildes y ñ). Permite un espacio entre palabras, pero sin números ni símbolos.
  private nombrePattern = /^[a-zA-ZñÑáéíóúÁÉÍÓÚ]+(?:\s[a-zA-ZñÑáéíóúÁÉÍÓÚ]+)*$/;
  
  // Email: Formato estricto estándar.
  private emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  private passwordPattern = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/;

  // Se eliminó el campo "matricula"
  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]], 
    nombre: [''], 
    dni: [''],
    telefono: ['']
  });

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const ref = params['ref'];
      const mode = params['mode'];

      if (ref) {
        this.referralCode = ref;
        this.isRegisterMode = true; 
        this.notificacionService.showSuccess('Código de invitación aplicado.');
      }

      if (mode === 'register') {
        this.isRegisterMode = true;
      } else if (mode === 'login') {
        this.isRegisterMode = false;
      }

      this.actualizarValidaciones();
    });
  }

  toggleMode() {
    this.isRegisterMode = !this.isRegisterMode;
    this.actualizarValidaciones();
  }

  actualizarValidaciones() {
    const c = this.loginForm.controls;
    
    if (this.isRegisterMode) {
      c.nombre.setValidators([
        Validators.required, 
        Validators.minLength(3), 
        Validators.pattern(this.nombrePattern)
      ]);
      c.dni.setValidators([
        Validators.required, 
        Validators.pattern(this.dniPattern)
      ]);
      c.telefono.setValidators([
        Validators.required,
        Validators.pattern(this.telefonoPattern)
      ]);
      c.email.setValidators([
        Validators.required,
        Validators.pattern(this.emailPattern)
      ]);
      c.password.setValidators([
        Validators.required,
        Validators.pattern(this.passwordPattern)
      ]);
    } else {
      c.nombre.clearValidators();
      c.dni.clearValidators();
      c.telefono.clearValidators();
      
      // En login mantenemos validación de formato de mail también
      c.email.setValidators([
        Validators.required,
        Validators.pattern(this.emailPattern)
      ]);
      c.password.setValidators([Validators.required]);
    }

    c.nombre.updateValueAndValidity();
    c.dni.updateValueAndValidity();
    c.telefono.updateValueAndValidity();
    c.email.updateValueAndValidity();
    c.password.updateValueAndValidity();
  }

  noWhitespaceValidator(control: AbstractControl): ValidationErrors | null {
    const isWhitespace = (control.value || '').trim().length === 0;
    const isValid = !isWhitespace;
    return isValid ? null : { 'whitespace': true };
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  get f() { return this.loginForm.controls; }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched(); 
      this.notificacionService.showError('Por favor verifique los datos ingresados.');
      return;
    }

    this.isLoading = true;
    const formValue = this.loginForm.value;

    if (this.isRegisterMode) {
      const datosRegistro = { ...formValue, referralCode: this.referralCode };

      this.authService.registro(datosRegistro).subscribe({
        next: (res: any) => {
          this.isLoading = false;
          this.router.navigate(['/cuenta-pendiente']);
        },
        error: (err: any) => { 
          this.isLoading = false;
          console.error(err);
          const mensaje = err.error?.message || 'Error al registrarse en el sistema.';
          this.notificacionService.showError(mensaje);
        }
      });

    } else {
      this.procesarLogin(formValue.email!, formValue.password!);
    }
  }

  private procesarLogin(email: string, pass: string) {
    this.authService.login({ email, password: pass }).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        
        this.authService.setSession(response.access_token);
        
        // Se retiró el uso de emojis para mantener la estética seria y legal
        this.notificacionService.showSuccess(`Bienvenido, ${response.user.nombre}.`);

        // 👇 ACÁ SEPARAMOS LAS RUTAS 👇
        if (this.authService.esAdmin) {
          this.router.navigate(['/admin-dashboard']);
        } else if (this.authService.esSindicato) {
          this.router.navigate(['/dashboard']); // Panel gerencial
        } else if (this.authService.esTramitador) {
          this.router.navigate(['/mis-casos']); // Panel de casos asignados
        } else {
           this.router.navigate(['/admin-dashboard']); 
        }
      },
      error: (err: any) => {
        // ... (todo el bloque de errores queda igual) ...
        this.isLoading = false;
        
        if (err.status === 403) {
          this.notificacionService.showWarning(
            'Cuenta en Revisión',
            'Su registro fue exitoso, pero un administrador debe aprobar la cuenta antes de permitir el ingreso.'
          );
        } 
        else if (err.status === 401) {
          this.notificacionService.showError('Credenciales incorrectas.');
        } 
        else {
          this.notificacionService.showError('Error de conexión con el servidor. Intente nuevamente.');
        }
      }
    });
  }

  recuperarPassword() {
    const emailIngresado = this.loginForm.get('email')?.value || '...';
    
    // Se ajustó el mensaje para que sea formal y libre de emojis
    const mensaje = `Estimados, necesito recuperar el acceso a mi cuenta del portal administrativo. Mi correo de registro es: ${emailIngresado}`;
    
    const numeroAdmin = "5491133360425"; 
    const urlWa = `https://wa.me/${numeroAdmin}?text=${encodeURIComponent(mensaje)}`;
    
    window.open(urlWa, '_blank');
  }
}