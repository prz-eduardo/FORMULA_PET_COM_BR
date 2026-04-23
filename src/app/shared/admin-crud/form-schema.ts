/**
 * Backwards-compatibility shim. The form schema now lives in
 * `shared/admin-page/form-schema.ts`. Re-export so existing pages keep
 * working.
 */
export type { ColumnDef, FormField, FormSchema, FormSchemaSection } from '../admin-page/form-schema';
