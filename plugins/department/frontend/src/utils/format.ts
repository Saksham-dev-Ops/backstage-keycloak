import { DepartmentStatus, TenantRole } from '../types';

/** "Priya Sharma" -> "PS" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

/** "84 / 500", "84 / –" without a limit, "–" when unknown */
export function usage(count?: number, limit?: number): string {
  if (count === undefined) {
    return '–';
  }
  return `${count} / ${limit ?? '–'}`;
}

export const STATUS_LABELS: Record<DepartmentStatus, string> = {
  active: 'Active',
  invite_pending: 'Admin not signed in yet',
  no_admin: 'No admin assigned',
  suspended: 'Suspended',
};

export const ROLE_LABELS: Record<TenantRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  DEVELOPER: 'Developer',
  VIEWER: 'Viewer',
};

export function formatDate(value?: string): string {
  if (!value) {
    return '–';
  }
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "DEPARTMENT_USER_ADDED" -> "Department user added" */
export function humanize(value: string): string {
  const text = value.toLowerCase().replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
