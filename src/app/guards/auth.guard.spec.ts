import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { authGuard } from './auth.guard';

describe('authGuard (class)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [authGuard]
    });
  });

  it('should be created', () => {
    const guard = TestBed.inject(authGuard);
    expect(guard).toBeTruthy();
  });
});
