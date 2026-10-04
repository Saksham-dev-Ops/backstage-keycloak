import { ComponentType } from 'react';
import { RoleTheme } from './createRoleTheme';

/**
 * The three UIs of the app:
 * - `platform-admin`: platform admins (`tenant.platformAdmins`), all data
 * - `organization`: owners and admins of the current organization
 * - `user`: developers and viewers, only the projects assigned to them
 */
export type RoleId = 'platform-admin' | 'organization' | 'user';

/** Sidebar items of the app, rendered by the role's sidebar */
export type RoleNav = {
  /** Takes a nav item by extension id, e.g. `page:catalog` */
  take(id: string): JSX.Element | null;
  rest(options?: { sortBy?: 'title' }): JSX.Element[];
};

export type RoleBrand = {
  /** Short mark shown in the sidebar, e.g. initials */
  mark: string;
  /** Shown next to the mark when the sidebar is open */
  wordmark: string;
  markColor: string;
  markTextColor: string;
};

export type RoleUi = {
  id: RoleId;
  brand: RoleBrand;
  theme: RoleTheme;
  /** Where `/` sends users with this role, e.g. right after sign-in */
  landingPath: string;
  /** Pages outside this send the user back to the landing page */
  isPathAllowed(pathname: string): boolean;
  Sidebar: ComponentType<{ nav: RoleNav }>;
};

export function matchesPath(pathname: string, paths: string[]) {
  return paths.some(path => pathname === path || pathname.startsWith(`${path}/`));
}
