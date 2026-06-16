import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { jwtDecode } from 'jwt-decode';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface User {
  id: string;
  email: string;
  nombre: string;
  role: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiUrl = environment.apiUrl;

  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;

  constructor() {
    const token = localStorage.getItem('access_token');
    let user = null;

    if (token) {
      try {
        user = jwtDecode<User>(token);
      } catch (error) {
        console.error('Error al decodificar token inicial', error);
      }
    }

    this.currentUserSubject = new BehaviorSubject<User | null>(user);
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  login(credentials: { email: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/login`, credentials);
  }

  registro(datosUsuario: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register`, datosUsuario);
  }

  setSession(token: string) {
    localStorage.setItem('access_token', token);
    try {
      const user = jwtDecode<User>(token);
      this.currentUserSubject.next(user);
    } catch (e) {
      console.error('Error al decodificar al hacer setSession', e);
    }
  }

  logout() {
    localStorage.removeItem('access_token');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return !!this.currentUserSubject.value;
  }

  // --- Getters de Roles Actualizados ---
  get esAdmin(): boolean {
    const role = this.currentUserValue?.role;
    return role === 'Admin' || role === 'ADMIN';
  }

  get esTramitador(): boolean {
    const role = this.currentUserValue?.role;
    return role === 'Tramitador' || role === 'TRAMITADOR';
  }

  get esSindicato(): boolean {
    const role = this.currentUserValue?.role;
    return role === 'Sindicato' || role === 'SINDICATO';
  }
}