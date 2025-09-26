import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../../firebase-config';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  email: string = '';
  senha: string = '';
  error: string = '';

  showForgot = false;
  forgotEmail = '';
  forgotMessage = '';

  constructor(private router: Router) {}

  login() {
    if (this.email === 'admin' && this.senha === 'admin') {
      this.router.navigate(['/restrito/admin']);
      return;
    }

    signInWithEmailAndPassword(auth, this.email, this.senha)
      .then(() => this.router.navigate(['/restrito/admin']))
      .catch(err => this.error = err.message);
  }

  async sendResetEmail() {
    if (!this.forgotEmail) return alert('Informe seu email');
    try {
      await sendPasswordResetEmail(auth, this.forgotEmail, {
        url: window.location.origin + '/login' // redireciona pro login após reset
      });
      this.forgotMessage = 'E-mail de redefinição enviado!';
      this.forgotEmail = '';
    } catch (err: any) {
      this.forgotMessage = 'Erro ao enviar email: ' + err.message;
      console.error(err);
    }
  }
}
