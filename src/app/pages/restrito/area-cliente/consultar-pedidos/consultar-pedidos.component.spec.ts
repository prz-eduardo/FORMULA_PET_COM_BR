import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConsultarPedidosComponent } from './consultar-pedidos.component';

describe('ConsultarPedidosComponent', () => {
  let component: ConsultarPedidosComponent;
  let fixture: ComponentFixture<ConsultarPedidosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsultarPedidosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConsultarPedidosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
