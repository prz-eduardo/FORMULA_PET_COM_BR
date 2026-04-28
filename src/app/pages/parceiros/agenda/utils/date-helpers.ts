/**
 * Utility helpers for agenda types
 */

export function toDate(value: Date | string | undefined | null): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  return new Date(value);
}

export function toDateString(value: Date | string | undefined | null): string {
  return toDate(value).toDateString();
}

export function getTime(value: Date | string | undefined | null): number {
  return toDate(value).getTime();
}
