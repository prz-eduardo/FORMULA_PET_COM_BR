/**
 * Backwards-compatibility shim. The admin CRUD shell now lives in
 * `shared/admin-page/` and is named `AdminPageComponent`. This file
 * re-exports it under the legacy `AdminCrudComponent` name so existing
 * pages that import from `shared/admin-crud/admin-crud.component` keep
 * working while migrating to `app-admin-page`.
 */
export { AdminPageComponent as AdminCrudComponent } from '../admin-page/admin-page.component';
export type { ColumnDef, FormField, FormSchema, FormSchemaSection } from '../admin-page/form-schema';
