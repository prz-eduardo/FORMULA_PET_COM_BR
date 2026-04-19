import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { AreaVetComponent } from './area-vet.component';

describe('AreaVetComponent', () => {
  let component: AreaVetComponent;
  let fixture: ComponentFixture<AreaVetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AreaVetComponent, HttpClientTestingModule, RouterTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AreaVetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
