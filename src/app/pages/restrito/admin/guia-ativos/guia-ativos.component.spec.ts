import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GuiaAtivosAdminComponent } from './guia-ativos.component';

describe('GuiaAtivosAdminComponent', () => {
  let component: GuiaAtivosAdminComponent;
  let fixture: ComponentFixture<GuiaAtivosAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuiaAtivosAdminComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GuiaAtivosAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
