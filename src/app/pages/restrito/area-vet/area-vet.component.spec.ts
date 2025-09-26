import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AreaVetComponent } from './area-vet.component';

describe('AreaVetComponent', () => {
  let component: AreaVetComponent;
  let fixture: ComponentFixture<AreaVetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AreaVetComponent]
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
