import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { CrieSuaContaClienteComponent } from './crie-sua-conta-cliente.component';

describe('CrieSuaContaClienteComponent', () => {
  let component: CrieSuaContaClienteComponent;
  let fixture: ComponentFixture<CrieSuaContaClienteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrieSuaContaClienteComponent, HttpClientTestingModule, RouterTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CrieSuaContaClienteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
