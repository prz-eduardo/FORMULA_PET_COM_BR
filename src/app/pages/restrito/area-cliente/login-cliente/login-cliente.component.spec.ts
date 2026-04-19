import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { LoginClienteComponent } from './login-cliente.component';

describe('LoginClienteComponent', () => {
  let component: LoginClienteComponent;
  let fixture: ComponentFixture<LoginClienteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginClienteComponent, HttpClientTestingModule, RouterTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginClienteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
