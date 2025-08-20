import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

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

  constructor(private router: Router) {}

  login() {
    // Bypass admin: user = admin, senha = admin
    if (this.email === 'admin' && this.senha === 'admin') {
      this.router.navigate(['/restrito/admin']);
      return;
    }

    // Firebase login
    const auth = getAuth();
    signInWithEmailAndPassword(auth, this.email, this.senha)
      .then(() => this.router.navigate(['/restrito/admin']))
      .catch(err => this.error = err.message);
  }
}
