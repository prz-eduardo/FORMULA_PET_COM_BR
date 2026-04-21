import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CrieSuaContaClienteComponent } from './crie-sua-conta-cliente.component';

describe('CrieSuaContaClienteComponent', () => {
  let component: CrieSuaContaClienteComponent;
  let fixture: ComponentFixture<CrieSuaContaClienteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrieSuaContaClienteComponent]
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
