import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { SwiperTopoComponent } from './swiper-topo.component';

describe('SwiperTopoComponent', () => {
  let component: SwiperTopoComponent;
  let fixture: ComponentFixture<SwiperTopoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SwiperTopoComponent, HttpClientTestingModule, RouterTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SwiperTopoComponent);
    component = fixture.componentInstance;
  });

  it('should create', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    expect(component).toBeTruthy();
  }));
});
