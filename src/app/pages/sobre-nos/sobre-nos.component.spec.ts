import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { SobreNosComponent } from './sobre-nos.component';

describe('SobreNosComponent', () => {
  let component: SobreNosComponent;
  let fixture: ComponentFixture<SobreNosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SobreNosComponent, HttpClientTestingModule, RouterTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SobreNosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
