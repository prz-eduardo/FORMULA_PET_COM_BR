import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SwiperTopoComponent } from './swiper-topo.component';

describe('SwiperTopoComponent', () => {
  let component: SwiperTopoComponent;
  let fixture: ComponentFixture<SwiperTopoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SwiperTopoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SwiperTopoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
