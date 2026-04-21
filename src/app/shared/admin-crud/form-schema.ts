export interface FormField {
  key: string;
  label?: string;
  type?: 'text' | 'number' | 'date' | 'datetime' | 'select' | 'checkbox' | 'textarea' | 'cpf' | 'email' | 'hidden' | 'multi-suggest';
  options?: Array<{ value: any; label: string }>;
  placeholder?: string;
  required?: boolean;
  default?: any;
  // function used to search related entities for `multi-suggest` fields.
  // Should accept a query string and return an Observable/Promise/Array of items.
  searchFn?: (q: string) => any;
  // optional key used to identify related entity label when rendering selected items
  relationKey?: string;
  width?: string;
  showInList?: boolean;
}

export interface FormSchema {
  fields?: FormField[];
  /**
   * Optional grouped sections for forms. When present, the admin-crud
   * renderer will render `sections` instead of the flat `fields` list.
   */
  sections?: Array<{ title?: string; twoUp?: boolean; fields: FormField[] }>;
  submitLabel?: string;
  allowDelete?: boolean;
  title?: string;
}
