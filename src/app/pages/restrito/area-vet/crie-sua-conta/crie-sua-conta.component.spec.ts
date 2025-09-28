import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CrieSuaContaComponent } from './crie-sua-conta.component';

describe('CrieSuaContaComponent', () => {
  let component: CrieSuaContaComponent;
  let fixture: ComponentFixture<CrieSuaContaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrieSuaContaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CrieSuaContaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
