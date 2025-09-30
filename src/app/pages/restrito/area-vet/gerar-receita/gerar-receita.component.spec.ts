import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GerarReceitaComponent } from './gerar-receita.component';

describe('GerarReceitaComponent', () => {
  let component: GerarReceitaComponent;
  let fixture: ComponentFixture<GerarReceitaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GerarReceitaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GerarReceitaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
