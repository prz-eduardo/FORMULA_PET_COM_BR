import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { AdminPromocoesComponent } from './promocoes.component';
import { AdminApiService, PromocaoDto } from '../../../../services/admin-api.service';
import { of } from 'rxjs';

class MockAdminApiService {
  listPromocoes() { return of({ items: [], total: 0 }); }
  getPromocao(id: any) { return of({ id, nome: 'X', produtos: [{ id: 11 }, { id: 22 }], descricao: 'd', tipo: 'percentual', valor: 10, inicio: null, fim: null, ativo: true } as PromocaoDto); }
  setPromocaoProdutos(id: any, produto_ids: number[]) { return of({ id } as any); }
  createPromocao(body: any) { return of({ id: 999, ...body } as any); }
  updatePromocao(id: any, body: any) { return of({ id, ...body } as any); }
}

describe('AdminPromocoesComponent', () => {
  let fixture: ComponentFixture<AdminPromocoesComponent>;
  let component: AdminPromocoesComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPromocoesComponent],
      providers: [{ provide: AdminApiService, useClass: MockAdminApiService }]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPromocoesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('opens editor when editing and resets correctly', fakeAsync(() => {
    expect(component.showCreateModal()).toBeFalse();
    // call edit
    component.editarPromocao({ id: 42 } as any);
    tick(); // allow subscription
    fixture.detectChanges();
    expect(component.editingId()).toBe(42);
    expect(component.showCreateModal()).toBeTrue();
    expect(component.editingItem).toBeTruthy();

    // simulate drawer close
    component.onDrawerOpenChange(false);
    tick();
    expect(component.editingId()).toBeNull();
    expect(component.editingItem).toBeNull();
  }));

  it('saves via onSchemaSubmit and calls setPromocaoProdutos when products present', fakeAsync(() => {
    const spySet = spyOn<any>(TestBed.inject(AdminApiService), 'setPromocaoProdutos').and.callThrough();
    // create new
    component.onSchemaSubmit({ values: { nome: 'novo', produtos: [5,6], tipo: 'percentual', valor: 5 } });
    tick();
    expect(spySet).toHaveBeenCalled();
  }));
});
