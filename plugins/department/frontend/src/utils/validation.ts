/**
 * Client-side checks that mirror the backend's, for immediate feedback. The
 * backend validates everything again.
 */
export type FieldErrors<K extends string> = Partial<Record<K, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requiredName(value: string, label: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return `${label} is required`;
  if (trimmed.length < 2) return `${label} must be at least 2 characters`;
  if (trimmed.length > 255) return `${label} must be at most 255 characters`;
  if (!/[a-z0-9]/i.test(trimmed)) return `${label} must contain letters or digits`;
  return undefined;
}

export function email(value: string): string | undefined {
  if (!value.trim()) return 'Email is required';
  return EMAIL.test(value.trim()) ? undefined : 'Enter a valid email address';
}

export function limit(value: string, label: string): string | undefined {
  if (!value.trim()) return `${label} is required`;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return `${label} must be a whole number of at least 1`;
  if (n > 1_000_000) return `${label} must be at most 1,000,000`;
  return undefined;
}

export function hasErrors(errors: Record<string, string | undefined>) {
  return Object.values(errors).some(Boolean);
}
