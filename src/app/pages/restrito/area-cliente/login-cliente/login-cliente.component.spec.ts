import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginClienteComponent } from './login-cliente.component';

describe('LoginClienteComponent', () => {
  let component: LoginClienteComponent;
  let fixture: ComponentFixture<LoginClienteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginClienteComponent]
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
