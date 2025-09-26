import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { auth, db } from '../../../firebase-config';
import { createUserWithEmailAndPassword, sendEmailVerification, updatePassword, updateProfile } from 'firebase/auth';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';

@Component({
  selector: 'app-usuarios',
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class UsuariosComponent implements OnInit {
  users: any[] = [];
  inviteEmail = '';
  inviteRole = 'user';
  currentUser: any = null;
  newPassword = '';
  newName = '';

  async ngOnInit() {
    this.currentUser = auth.currentUser;
    if (this.currentUser) {
      this.newName = this.currentUser.displayName || '';
    }
    await this.fetchUsers();
  }

  async fetchUsers() {
    const snapshot = await getDocs(collection(db, 'users'));
    this.users = snapshot.docs.map(d => ({ uid: d.id, ...d.data() }));
  }

  // Cadastra novo usuário + salva no Firestore
  async sendInvite() {
    if (!this.inviteEmail) return alert('Informe o email');
    try {
      const tempPassword = Math.random().toString(36).slice(-8);
      const userCred = await createUserWithEmailAndPassword(auth, this.inviteEmail, tempPassword);
      
      // Salva dados no Firestore
      await setDoc(doc(db, 'users', userCred.user.uid), {
        email: this.inviteEmail,
        role: this.inviteRole,
        name: ''
      });

      // Envia email de verificação
      await sendEmailVerification(userCred.user);
      alert('Invite enviado com sucesso!');
      this.inviteEmail = '';
      this.inviteRole = 'user';
      await this.fetchUsers();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao enviar invite: ' + err.message);
    }
  }

  async updateProfile() {
    try {
      if (this.newName) await updateProfile(auth.currentUser!, { displayName: this.newName });
      if (this.newPassword) await updatePassword(auth.currentUser!, this.newPassword);
      alert('Perfil atualizado com sucesso!');
      this.newPassword = '';
    } catch (err: any) {
      console.error(err);
      alert('Erro ao atualizar perfil: ' + err.message);
    }
  }

  async deleteUser(uid: string) {
    if (confirm('Remover usuário do Firestore?')) {
      await setDoc(doc(db, 'users', uid), { deleted: true }, { merge: true });
      await this.fetchUsers();
      alert('Usuário marcado como deletado no Firestore. Para remover do Auth, admin SDK seria necessário.');
    }
  }
}
