import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Notificacion } from '../../services/notificacion';

@Component({
  selector: 'app-notificacion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notificacion.html'
  // Chau styleUrl: './notificacion.scss' 🚀
})
export class NotificacionComponent {
  @Input() notificacion!: Notificacion;
  @Output() close = new EventEmitter<number>();

  onClose() {
    this.close.emit(this.notificacion.id);
  }
}