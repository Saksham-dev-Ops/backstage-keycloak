export const ROLES = ['OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

export type TenantStatus = 'active' | 'suspended';

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
};

export type User = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type Membership = {
  id: string;
  userId: string;
  tenantId: string;
  role: Role;
  createdAt: string;
};

export type Member = Membership & { email: string; name: string };

export type Project = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export type Environment = {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

/** A configuration entry as stored; secret values live in the SecretProvider. */
export type Configuration = {
  id: string;
  projectId: string;
  environmentId: string;
  key: string;
  value?: string;
  isSecret: boolean;
  secretRef?: string;
  createdAt: string;
  updatedAt: string;
};

/** The authenticated application user plus the tenant the request acts in. */
export type TenantContext = {
  user: User;
  tenant: Tenant;
  role: Role;
};
