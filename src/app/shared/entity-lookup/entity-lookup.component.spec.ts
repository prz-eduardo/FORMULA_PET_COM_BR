import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { EntityLookupComponent } from './entity-lookup.component';
import { of } from 'rxjs';

describe('EntityLookupComponent', () => {
  let component: EntityLookupComponent;
  let fixture: ComponentFixture<EntityLookupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntityLookupComponent]
    }).compileComponents();
    fixture = TestBed.createComponent(EntityLookupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders input and placeholder', () => {
    component.placeholder = 'Buscar produtos';
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input');
    expect(input).toBeTruthy();
    expect(input.placeholder).toBe('Buscar produtos');
  });

  it('calls searchFn and shows suggestions (debounced)', fakeAsync(() => {
    const items = [{ id: 1, name: 'Produto A' }];
    component.searchFn = (q: string) => of(items);
    fixture.detectChanges();
    component.searchControl.setValue('prod');
    component.onInput();
    tick(300);
    fixture.detectChanges();
    const lis = fixture.nativeElement.querySelectorAll('.sugestoes li');
    expect(lis.length).toBe(1);
    expect(lis[0].textContent).toContain('Produto A');
  }));

  it('adds and removes ids and emits selectedIdsChange', fakeAsync(() => {
    const spy = jasmine.createSpy('selectedChange');
    component.selectedIdsChange.subscribe(spy);
    component.selectedIds = [];
    component.add(5);
    expect(component.selectedIds).toEqual([5]);
    expect(spy).toHaveBeenCalledWith([5]);
    component.remove(5);
    expect(component.selectedIds).toEqual([]);
    expect(spy).toHaveBeenCalledTimes(2);
  }));
});
