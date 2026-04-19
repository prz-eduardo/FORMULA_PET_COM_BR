import { TestBed } from '@angular/core/testing';
import { AdminCrudComponent } from './admin-crud.component';
import { FormSchema } from './form-schema';

describe('AdminCrudComponent (form schema)', () => {
  let component: AdminCrudComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCrudComponent]
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminCrudComponent);
    component = fixture.componentInstance;
  });

  it('builds form with multi-suggest default value as array and validates required', () => {
    const schema: FormSchema = {
      title: 'Teste',
      fields: [
        { key: 'nome', type: 'text', required: true },
        { key: 'produtos', type: 'multi-suggest', required: true }
      ]
    };
    component.formSchema = schema;
    component.editItem = null;
    component.buildForm();
    const ctrlNome = component.autoForm.get('nome');
    const ctrlProdutos = component.autoForm.get('produtos');
    expect(ctrlNome).toBeTruthy();
    expect(ctrlProdutos).toBeTruthy();
    // produtos should default to array
    expect(Array.isArray(ctrlProdutos?.value)).toBeTrue();
    // required validator should mark produtos invalid when empty
    expect(ctrlProdutos?.valid).toBeFalse();
    // set produtos and verify validity
    ctrlProdutos?.setValue([1,2]);
    expect(ctrlProdutos?.valid).toBeTrue();
  });
});
