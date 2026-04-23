import { FormBuilder, FormGroup } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';

export interface AddressValue {
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  city?: string | null;
  uf?: string | null;
}

/** Build a FormGroup with the canonical address shape. */
export function buildAddressGroup(fb: FormBuilder, initial: AddressValue = {}): FormGroup {
  return fb.group({
    cep: [formatCepDisplay(initial.cep ?? '')],
    logradouro: [initial.logradouro ?? ''],
    numero: [initial.numero ?? ''],
    complemento: [initial.complemento ?? ''],
    bairro: [initial.bairro ?? ''],
    city: [initial.city ?? ''],
    uf: [(initial.uf ?? '').toString().toUpperCase().slice(0, 2)]
  });
}

/** Return only the digits of the CEP (max 8). */
export function cepDigitsOnly(v: string | null | undefined): string {
  return (v || '').replace(/\D+/g, '').slice(0, 8);
}

/** Format a CEP string as 00000-000. */
export function formatCepDisplay(v: string | null | undefined): string {
  const d = cepDigitsOnly(v);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/**
 * Flatten an `address` FormGroup value onto the root payload object for
 * submission, stripping the `address` key and keeping individual fields.
 */
export function flattenAddress<T extends { address?: AddressValue } & Record<string, any>>(value: T): Record<string, any> {
  const { address, ...rest } = value || ({} as any);
  const addr = address || {};
  return {
    ...rest,
    cep: cepDigitsOnly(addr.cep ?? ''),
    logradouro: addr.logradouro ?? '',
    numero: addr.numero ?? '',
    complemento: addr.complemento ?? '',
    bairro: addr.bairro ?? '',
    city: addr.city ?? '',
    uf: (addr.uf ?? '').toString().toUpperCase().slice(0, 2)
  };
}

/**
 * Look up a CEP via ViaCEP (fallback to BrasilAPI) and return partial fields
 * to patch into the address form group.
 */
export function lookupCep(api: ApiService, cep: string): Observable<AddressValue | null> {
  const clean = cepDigitsOnly(cep);
  if (clean.length !== 8) return of(null);
  return api.buscarCepViaCep(clean).pipe(
    map((res: any) => {
      if (!res || res.erro) return null;
      return {
        cep: formatCepDisplay(res.cep || clean),
        logradouro: res.logradouro || '',
        complemento: res.complemento || '',
        bairro: res.bairro || '',
        city: res.localidade || '',
        uf: (res.uf || '').toString().toUpperCase().slice(0, 2)
      } as AddressValue;
    }),
    catchError(() => of(null))
  );
}
