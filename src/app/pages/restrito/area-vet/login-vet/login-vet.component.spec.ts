import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { LoginVetComponent } from './login-vet.component';

describe('LoginVetComponent', () => {
  let component: LoginVetComponent;
  let fixture: ComponentFixture<LoginVetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginVetComponent, HttpClientTestingModule, RouterTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginVetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
