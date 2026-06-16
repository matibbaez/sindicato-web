import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { TerminosModalComponent } from '../../components/terminos-modal/terminos-modal';
import { ReclamosService } from '../../services/reclamos.service';
import { NotificacionService } from '../../services/notificacion';
import { ImageCompressService } from '../../services/image-compress.service';
import { UiSignatureComponent } from '../../components/ui-signature/ui-signature';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-iniciar-reclamo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, TerminosModalComponent, UiSignatureComponent],
  templateUrl: './iniciar-reclamo.html'
})
export class IniciarReclamoComponent implements OnInit {

  @ViewChild('firmaPad') firmaPad!: UiSignatureComponent;
  errorFirma = false;
  
  private fb = inject(FormBuilder);
  private reclamosService = inject(ReclamosService); 
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private notificacionService = inject(NotificacionService);
  private imageCompressService = inject(ImageCompressService);
  private authService = inject(AuthService); 

  docActivo: 'poder' | 'honorarios' | 'no_seguro' = 'poder';
  mostrarTerminos = true; 
  isLoading = false;
  isCompressing = false; 
  pasoActual = 0; 
  
  provincias = [
    'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 
    'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 
    'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 
    'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
  ];

  aseguradoras = [
    'Federacion Patronal', 'Allianz', 'Zurich', 'San Cristobal', 'La Caja Seguros',
    'La Equitativa del Plata', 'Sancor', 'La Meridional', 'Mapfre', 'Provincia Seguros',
    'HDI', 'S.M.G', 'Experta', 'Rivadavia', 'Galicia', 'Integrity', 'La Segunda',
    'Nacion', 'Segurcoop', 'Mercantil Andina', 'Berkley', 'Colon', 'Victoria',
    'El Norte', 'La Holando Sudamericana', 'Cooperacion Mutual', 'Otra'
  ];

  private nombrePattern = /^[a-zA-Z0-9ñÑáéíóúÁÉÍÓÚ\s.]+$/; 
  private dniPattern = /^[0-9]{7,11}$/; 
  private telPattern = /^[0-9]{10,13}$/;
  private patentePattern = /^[a-zA-Z0-9]{6,7}$/;
  private cbuPattern = /^[0-9]{22}$/;

  reclamoForm = this.fb.group({
    codigo_ref: [''],
    
    // --- DATOS OBLIGATORIOS (Los únicos que trancan el form) ---
    nombre: ['', [Validators.required, Validators.minLength(3), Validators.pattern(this.nombrePattern), this.noWhitespaceValidator]],
    telefono: ['', [Validators.required, Validators.pattern(this.telPattern)]],
    dni: ['', [Validators.required, Validators.pattern(this.dniPattern)]], 
    rol_victima: ['', Validators.required],
    
    // --- DATOS PERSONALES OPCIONALES ---
    email: ['', [Validators.required, Validators.email]],
    domicilio_usuario: [''],
    cbu: ['', [Validators.pattern(this.cbuPattern)]], 

    // --- DATOS SINIESTRO OPCIONALES ---
    tiene_seguro: [true], 
    hizo_denuncia: [false],
    sufrio_lesiones: [false], 
    in_itinere: [false],
    posee_art: [false],

    fecha_hecho: [''], 
    hora_hecho: [''],
    lugar_hecho: [''],
    localidad: [''],
    provincia: [''],
    relato_hecho: [''], 
    
    intervino_policia: [false],
    intervino_ambulancia: [false],
    patente_propia: ['', [Validators.pattern(this.patentePattern)]], 

    // --- TERCERO OPCIONALES ---
    aseguradora_tercero: [''],
    patente_tercero: ['', [Validators.pattern(this.patentePattern)]],
    tercero_nombre: [''],
    tercero_apellido: [''],
    tercero_dni: [''],
    tercero_marca_modelo: [''],

    // --- ARCHIVOS (Todos Opcionales) ---
    fileDNI: [null],           
    fileLicencia: [null],      
    fileCedula: [null],        
    fileFotos: [null],         
    fileComplementaria: [null],
    fileSeguro: [null],        
    fileDenuncia: [null],      
    filePresupuesto: [null],   
    fileMedicos: [null],       
    fileCBU: [null],           
    fileDenunciaPenal: [null]  
  });

  ngOnInit(): void {
    const valoresIniciales = {
      nombre: '', dni: '', email: '', telefono: '', domicilio_usuario: '', cbu: '',
      rol_victima: '', 
      tiene_seguro: true, sufrio_lesiones: false, in_itinere: false, posee_art: false,
      intervino_policia: false, intervino_ambulancia: false,
      fecha_hecho: '', hora_hecho: '', lugar_hecho: '', localidad: '', provincia: '', relato_hecho: '',
      patente_propia: '', aseguradora_tercero: '', patente_tercero: '',
      tercero_nombre: '', tercero_apellido: '', tercero_dni: '', tercero_marca_modelo: '',
      fileDNI: null, fileLicencia: null, fileCedula: null, fileSeguro: null, fileDenuncia: null,
      filePresupuesto: null, fileFotos: null, fileMedicos: null, fileCBU: null, fileDenunciaPenal: null,
      fileComplementaria: null,
      codigo_ref: ''
    };

    this.reclamoForm.reset(valoresIniciales);
    this.pasoActual = 0;
    this.isLoading = false;

    this.route.queryParams.subscribe((params: any) => {
      const referido = params['ref'];
      if (referido) {
        this.reclamoForm.patchValue({ codigo_ref: referido });
      }
    });
  }

  get noRequiereFirma(): boolean {
    return this.authService.isAuthenticated(); 
  }

  // --- GETTERS DE TEXTOS LEGALES ---
  get textoPoder(): string {
    return `SE PRESENTA – DESIGNA LETRADO – CONSTITUYE DOMICILIO\n\n${this.v.nombre}, DNI ${this.v.dni || 'A completar'}, por derecho propio, conjuntamente con mi abogado patrocinante, el Dr. Agustín Exequiel Simonelli, Tº 141, Fº 755, CPACF, CUIT 20-36045548-4, constituyendo domicilio legal en Gallo 1435 piso 9 de Capital Federal, teléfono 11-3336-0425, ante quien corresponda me presento y respetuosamente digo:\n\nQue vengo a presentarme, designando como único letrado patrocinante al Dr. Agustín Exequiel Simonelli...`;
  }

  get textoHonorarios(): string {
    const fecha = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
    return `CONVENIO DE HONORARIOS PROFESIONALES\n\nEn la ciudad de Buenos Aires, a los ${fecha}, ENTRE: ${this.v.nombre}, DNI ${this.v.dni || 'A completar'}, en adelante “EL CLIENTE”, por una parte, y el señor AGUSTIN EXEQUIEL SIMONELLI...`;
  }

  get textoNoSeguro(): string {
    const fecha = new Date().toLocaleDateString('es-AR');
    return `DECLARACIÓN JURADA - INEXISTENCIA DE SEGURO\nBuenos Aires, ${fecha}\n\nPor la presente, yo, ${this.v.nombre}, titular del DNI Nº ${this.v.dni || 'A completar'}, declaro bajo juramento que al momento del siniestro ocurrido el día ${this.v.fecha_hecho || 'A completar'} en ${this.v.lugar_hecho || 'A completar'}, mi vehículo NO poseía cobertura de seguro...`;
  }

  // --- VALIDATORS HELPERS ---
  onFirmaRealizada() { this.errorFirma = false; }

  noWhitespaceValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null; // Ahora permitimos vacíos (es opcional)
    const isWhitespace = control.value.trim().length === 0;
    return !isWhitespace ? null : { 'whitespace': true };
  }

  get f() { return this.reclamoForm.controls; }
  get v() { return this.reclamoForm.value; }

  // --- NAVEGACIÓN Y STEPS ---
  aceptarTerminos() { this.mostrarTerminos = false; }
  cancelarTerminos() { this.router.navigate(['/']); }

  seleccionarRol(rol: string) {
    this.reclamoForm.patchValue({ rol_victima: rol });
    if (rol !== 'Conductor') {
      this.reclamoForm.patchValue({ tiene_seguro: false, in_itinere: false, posee_art: false });
    } else {
      this.reclamoForm.patchValue({ tiene_seguro: true });
    }
    this.pasoActual = 1;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  volverAStep1() { 
    this.pasoActual = 0; 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  avanzarAPaso2() {
    // Agregamos la validación del email 👇
    if (this.f['nombre'].invalid || this.f['telefono'].invalid || this.f['dni'].invalid || this.f['email'].invalid) {
      this.f['nombre'].markAsTouched();
      this.f['telefono'].markAsTouched();
      this.f['dni'].markAsTouched();
      this.f['email'].markAsTouched(); // <-- Le decimos a Angular que muestre el error del email
      
      this.notificacionService.showError('Revisá los datos personales. Son todos obligatorios.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    this.pasoActual = 2;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  volverAPaso1() {
    this.pasoActual = 1;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  irAConfirmacion() {
    // Ya no bloqueamos por falta de fotos ni documentos
    this.pasoActual = 3;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  editarDatos() {
    this.pasoActual = 1; 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- LOGICA TOGGLES ---
  get hizoDenuncia(): boolean { return this.reclamoForm.get('hizo_denuncia')?.value === true; }
  get esConductor(): boolean { return this.reclamoForm.get('rol_victima')?.value === 'Conductor'; }
  get tieneSeguro(): boolean { return this.reclamoForm.get('tiene_seguro')?.value === true; }
  get isInItinere(): boolean { return this.reclamoForm.get('in_itinere')?.value === true; }

  toggleDenuncia(checked: boolean) {
    this.reclamoForm.patchValue({ hizo_denuncia: checked });
  }

  toggleSeguro(checked: boolean) {
    this.reclamoForm.patchValue({ tiene_seguro: checked });
  }

  actualizarValidaciones(rol: string) {
    // Limpiamos esta función porque ya no dynamically hacemos required ningún campo.
    // Mantenemos la función para compatibilidad con el HTML.
  }

  // --- MANEJO DE ARCHIVOS (Múltiples y Únicos) ---
  async onFileChange(event: any, controlName: string) {
    const input = event.target;
    if (!input.files || input.files.length === 0) return;

    const isMultiple = ['fileFotos', 'fileDNI', 'fileLicencia', 'fileCedula', 'fileSeguro', 'fileDenuncia', 'fileMedicos', 'filePresupuesto', 'fileCBU', 'fileDenunciaPenal', 'fileComplementaria'].includes(controlName);
    const maxFiles = controlName === 'fileFotos' ? 7 : 4; 
    
    const newFiles = Array.from(input.files) as File[];
    
    // 1. Prendemos los loaders de inmediato en la UI
    this.isCompressing = true;
    this.isLoading = true; 

    // 2. Liberamos el hilo para que el loader se dibuje (150ms)
    setTimeout(async () => {
      
      // Guardamos la hora exacta en la que empieza el proceso
      const tiempoInicio = Date.now();

      try {
        const compressedNewFiles: File[] = [];
        for (const file of newFiles) {
          const compressed = await this.imageCompressService.compressFile(file);
          compressedNewFiles.push(compressed);
        }

        if (isMultiple) {
          const currentVal = this.reclamoForm.get(controlName)?.value as any;
          let currentFiles: File[] = [];

          if (currentVal) {
              currentFiles = (currentVal instanceof FileList) 
                ? Array.from(currentVal) 
                : (Array.isArray(currentVal) ? currentVal : [currentVal]);
          }
          
          if (currentFiles.length + compressedNewFiles.length > maxFiles) {
              this.notificacionService.showError(`Máximo ${maxFiles} archivos permitidos para este campo.`);
          } else {
              const combinedFiles = [...currentFiles, ...compressedNewFiles];
              this.reclamoForm.patchValue({ [controlName]: combinedFiles as any });
          }
        } else {
          if (newFiles.length > 1) {
              this.notificacionService.showError('Solo se permite un archivo para este campo.');
          }
          this.reclamoForm.patchValue({ [controlName]: compressedNewFiles[0] });
        }
        this.reclamoForm.get(controlName)?.updateValueAndValidity();

      } catch (e) {
        console.error("Error procesando archivos", e);
        this.notificacionService.showError('Error al procesar el archivo. Intente nuevamente.');
      } finally {
        
        // 3. Calculamos cuánto tardó el proceso real
        const tiempoTranscurrido = Date.now() - tiempoInicio;
        
        // Si tardó menos de 1000ms (1 segundo), calculamos lo que le falta. Si tardó más, esto da 0.
        const tiempoEspera = Math.max(0, 1000 - tiempoTranscurrido);

        // 4. Apagamos el spinner recién cuando se cumpla el tiempo
        setTimeout(() => {
          this.isCompressing = false;
          this.isLoading = false;
          input.value = ''; 
        }, tiempoEspera);
        
      }
    }, 150); 
  }

  borrarArchivo(controlName: string, index: number) {
     const currentVal = this.reclamoForm.get(controlName)?.value as any;
     if (currentVal) {
        let currentFiles: File[] = [];
        if (Array.isArray(currentVal)) {
            currentFiles = [...currentVal];
        } else if (currentVal instanceof FileList) {
            currentFiles = Array.from(currentVal);
        } else {
            this.reclamoForm.patchValue({ [controlName]: null });
            return;
        }

        currentFiles.splice(index, 1);
        const newValue = currentFiles.length > 0 ? currentFiles : null;
        this.reclamoForm.patchValue({ [controlName]: newValue as any });
     }
  }

  borrarFoto(index: number) {
      this.borrarArchivo('fileFotos', index);
  }

  getFilesList(controlName: string): string[] {
      const files = this.reclamoForm.get(controlName)?.value as any;
      if (!files) return [];
      if (Array.isArray(files)) return files.map((f: any) => f.name);
      if (files instanceof FileList) return Array.from(files).map((f: any) => f.name);
      if (files instanceof File) return [files.name];
      return [];
  }

  get fotosList(): string[] {
      return this.getFilesList('fileFotos');
  }

  // --- ENVÍO DEL FORMULARIO ---
  async confirmarConFirma() {
    if (!this.noRequiereFirma && this.firmaPad.isEmpty()) {
      this.errorFirma = true;
      this.notificacionService.showError('Por favor, firme en el recuadro para continuar.');
      return;
    }

    this.isLoading = true;
    const v = this.reclamoForm.value;
    const formData = new FormData();

    if (!this.noRequiereFirma) {
      const firmaBlob = await this.firmaPad.getSignatureBlob();
      formData.append('fileFirma', firmaBlob, 'firma_digital.png'); 
    }

    for (const key of Object.keys(v)) {
        // @ts-ignore
        const value = v[key];
        if (value === null || value === undefined || value === '') continue;

        if (Array.isArray(value) && value.length > 0 && value[0] instanceof File) {
            value.forEach((file: File) => {
                formData.append(key, file); 
            });
        } else if (value instanceof File) {
            formData.append(key, value);
        } else {
             formData.append(key, String(value));
        }
    }

    this.reclamosService.crearReclamo(formData).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.router.navigate(['/exito'], { state: { codigo: res.codigo_seguimiento, nombre: v.nombre } });
      },
      error: (err) => {
        this.isLoading = false;
        const mensaje = err.error?.message || 'Error de conexión o datos inválidos.';
        this.notificacionService.showError(mensaje);
        console.error('Error detallado:', err);
      }
    });
  }
}