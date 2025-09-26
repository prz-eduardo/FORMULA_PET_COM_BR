import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GuiaAtivosComponent } from './guia-ativos.component';

describe('GuiaAtivosComponent', () => {
  let component: GuiaAtivosComponent;
  let fixture: ComponentFixture<GuiaAtivosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuiaAtivosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GuiaAtivosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
