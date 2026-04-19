import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { AreaClienteComponent } from './area-cliente.component';

describe('AreaClienteComponent', () => {
  let component: AreaClienteComponent;
  let fixture: ComponentFixture<AreaClienteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AreaClienteComponent, HttpClientTestingModule, RouterTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AreaClienteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
