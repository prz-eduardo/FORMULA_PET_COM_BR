import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GuiaRestritosComponent } from './guia-restritos.component';

describe('GuiaRestritosComponent', () => {
  let component: GuiaRestritosComponent;
  let fixture: ComponentFixture<GuiaRestritosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuiaRestritosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GuiaRestritosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
