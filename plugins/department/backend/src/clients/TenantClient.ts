import {
  AuthService,
  BackstageCredentials,
  DiscoveryService,
} from '@backstage/backend-plugin-api';
import {
  AuthenticationError,
  ConflictError,
  InputError,
  NotAllowedError,
  NotFoundError,
  ServiceUnavailableError,
} from '@backstage/errors';
import { TenantRole } from '../types';

export type TenantAdmin = {
  userId: string;
  email: string;
  name: string;
  role: TenantRole;
  lastSignInAt?: string;
};

/** A tenant as seen by platform admins (`/admin/tenants`) */
export type PlatformTenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  memberCount: number;
  projectCount: number;
  admins: TenantAdmin[];
};

export type TenantInvite = { token: string; expiresAt: string };

export type TenantMember = {
  userId: string;
  email: string;
  name: string;
  role: TenantRole;
  createdAt: string;
  lastSignInAt?: string;
  /** Only in platform admin listings */
  hasPassword?: boolean;
  /** Set when adding the member created an account without a password */
  invite?: TenantInvite;
};

export type NewTenant = {
  name: string;
  slug: string;
  ownerEmail: string;
  ownerName: string;
  additionalOwners?: Array<{ email: string; name: string }>;
};

export type CreatedTenant = {
  id: string;
  owners: Array<{
    userId: string;
    email: string;
    accountCreated: boolean;
    invite?: TenantInvite;
  }>;
};

export type TenantProject = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  tenantId?: string;
  environmentCount: number;
  assignedMemberCount?: number;
  updatedAt: string;
};

export type TenantMe = {
  user: { id: string; email: string; name: string };
  isPlatformAdmin: boolean;
  tenants: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    role: TenantRole;
  }>;
};

export type NewMember = {
  email: string;
  name?: string;
  role: TenantRole;
  password?: string;
};

/**
 * The tenant plugin's API, as used by this plugin. Users, memberships and
 * projects live only in the tenant plugin.
 */
export interface TenantDirectory {
  me(credentials: BackstageCredentials): Promise<TenantMe>;

  // Platform admin only; the tenant plugin checks that again
  listTenants(credentials: BackstageCredentials): Promise<PlatformTenant[]>;
  getTenant(
    credentials: BackstageCredentials,
    tenantId: string,
  ): Promise<PlatformTenant>;
  createTenant(
    credentials: BackstageCredentials,
    input: NewTenant,
  ): Promise<CreatedTenant>;
  regenerateInvite(
    credentials: BackstageCredentials,
    userId: string,
  ): Promise<TenantInvite>;
  updateTenant(
    credentials: BackstageCredentials,
    tenantId: string,
    changes: { name?: string; status?: 'active' | 'suspended' },
  ): Promise<void>;
  deleteTenant(
    credentials: BackstageCredentials,
    tenantId: string,
  ): Promise<void>;
  listTenantMembersAsAdmin(
    credentials: BackstageCredentials,
    tenantId: string,
  ): Promise<TenantMember[]>;
  addTenantMemberAsAdmin(
    credentials: BackstageCredentials,
    tenantId: string,
    input: NewMember,
  ): Promise<TenantMember>;
  updateTenantMemberAsAdmin(
    credentials: BackstageCredentials,
    tenantId: string,
    userId: string,
    role: TenantRole,
  ): Promise<TenantMember>;
  removeTenantMemberAsAdmin(
    credentials: BackstageCredentials,
    tenantId: string,
    userId: string,
  ): Promise<void>;
  listProjectsAsAdmin(
    credentials: BackstageCredentials,
    tenantId: string,
  ): Promise<TenantProject[]>;

  // Tenant-scoped: the tenant plugin verifies membership and role
  listMembers(
    credentials: BackstageCredentials,
    tenantId: string,
  ): Promise<TenantMember[]>;
  addMember(
    credentials: BackstageCredentials,
    tenantId: string,
    input: NewMember,
  ): Promise<TenantMember>;
  updateMember(
    credentials: BackstageCredentials,
    tenantId: string,
    userId: string,
    role: TenantRole,
  ): Promise<TenantMember>;
  removeMember(
    credentials: BackstageCredentials,
    tenantId: string,
    userId: string,
  ): Promise<void>;
  listProjects(
    credentials: BackstageCredentials,
    tenantId: string,
  ): Promise<TenantProject[]>;
}

const ERRORS_BY_NAME: Record<string, new (message: string) => Error> = {
  InputError,
  AuthenticationError,
  NotAllowedError,
  NotFoundError,
  ConflictError,
};

/**
 * Calls the tenant plugin on behalf of the caller, so that the tenant plugin
 * applies its own authentication, membership and role checks as well.
 */
export class TenantClient implements TenantDirectory {
  constructor(
    private readonly options: {
      discovery: DiscoveryService;
      auth: AuthService;
    },
  ) {}

  me(credentials: BackstageCredentials) {
    return this.request<TenantMe>(credentials, '/me');
  }

  async listTenants(credentials: BackstageCredentials) {
    return (
      await this.request<{ items: PlatformTenant[] }>(
        credentials,
        '/admin/tenants',
      )
    ).items;
  }

  getTenant(credentials: BackstageCredentials, tenantId: string) {
    return this.request<PlatformTenant>(
      credentials,
      `/admin/tenants/${enc(tenantId)}`,
    );
  }

  async createTenant(
    credentials: BackstageCredentials,
    input: NewTenant,
  ): Promise<CreatedTenant> {
    const res = await this.request<{
      tenant: { id: string };
      owners: CreatedTenant['owners'];
    }>(credentials, '/tenants', { method: 'POST', body: input });
    return { id: res.tenant.id, owners: res.owners };
  }

  regenerateInvite(credentials: BackstageCredentials, userId: string) {
    return this.request<TenantInvite>(
      credentials,
      `/admin/users/${enc(userId)}/invite`,
      {
        method: 'POST',
      },
    );
  }

  async updateTenant(
    credentials: BackstageCredentials,
    tenantId: string,
    changes: { name?: string; status?: 'active' | 'suspended' },
  ) {
    await this.request(credentials, `/admin/tenants/${enc(tenantId)}`, {
      method: 'PATCH',
      body: changes,
    });
  }

  async deleteTenant(credentials: BackstageCredentials, tenantId: string) {
    await this.request(credentials, `/admin/tenants/${enc(tenantId)}`, {
      method: 'DELETE',
    });
  }

  async listTenantMembersAsAdmin(
    credentials: BackstageCredentials,
    tenantId: string,
  ) {
    const path = `/admin/tenants/${enc(tenantId)}/members`;
    return (await this.request<{ items: TenantMember[] }>(credentials, path))
      .items;
  }

  addTenantMemberAsAdmin(
    credentials: BackstageCredentials,
    tenantId: string,
    input: NewMember,
  ) {
    return this.request<TenantMember>(
      credentials,
      `/admin/tenants/${enc(tenantId)}/members`,
      {
        method: 'POST',
        body: input,
      },
    );
  }

  updateTenantMemberAsAdmin(
    credentials: BackstageCredentials,
    tenantId: string,
    userId: string,
    role: TenantRole,
  ) {
    const path = `/admin/tenants/${enc(tenantId)}/members/${enc(userId)}`;
    return this.request<TenantMember>(credentials, path, {
      method: 'PATCH',
      body: { role },
    });
  }

  async removeTenantMemberAsAdmin(
    credentials: BackstageCredentials,
    tenantId: string,
    userId: string,
  ) {
    const path = `/admin/tenants/${enc(tenantId)}/members/${enc(userId)}`;
    await this.request(credentials, path, { method: 'DELETE' });
  }

  async listProjectsAsAdmin(
    credentials: BackstageCredentials,
    tenantId: string,
  ) {
    const query = new URLSearchParams({ tenantId });
    return (
      await this.request<{ items: TenantProject[] }>(
        credentials,
        `/admin/projects?${query}`,
      )
    ).items;
  }

  async listMembers(credentials: BackstageCredentials, tenantId: string) {
    return (
      await this.request<{ items: TenantMember[] }>(credentials, '/members', {
        tenantId,
      })
    ).items;
  }

  addMember(
    credentials: BackstageCredentials,
    tenantId: string,
    input: NewMember,
  ) {
    return this.request<TenantMember>(credentials, '/members', {
      method: 'POST',
      body: input,
      tenantId,
    });
  }

  updateMember(
    credentials: BackstageCredentials,
    tenantId: string,
    userId: string,
    role: TenantRole,
  ) {
    return this.request<TenantMember>(credentials, `/members/${enc(userId)}`, {
      method: 'PATCH',
      body: { role },
      tenantId,
    });
  }

  async removeMember(
    credentials: BackstageCredentials,
    tenantId: string,
    userId: string,
  ) {
    await this.request(credentials, `/members/${enc(userId)}`, {
      method: 'DELETE',
      tenantId,
    });
  }

  async listProjects(credentials: BackstageCredentials, tenantId: string) {
    return (
      await this.request<{ items: TenantProject[] }>(credentials, '/projects', {
        tenantId,
      })
    ).items;
  }

  private async request<T = void>(
    credentials: BackstageCredentials,
    path: string,
    options: { method?: string; body?: unknown; tenantId?: string } = {},
  ): Promise<T> {
    const [baseUrl, { token }] = await Promise.all([
      this.options.discovery.getBaseUrl('tenant'),
      this.options.auth.getPluginRequestToken({
        onBehalfOf: credentials,
        targetPluginId: 'tenant',
      }),
    ]);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (options.tenantId) {
      // Only a selector: the tenant plugin verifies membership of this tenant
      headers['x-tenant-id'] = options.tenantId;
    }
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) {
      throw await toError(response);
    }
    return response.status === 204
      ? (undefined as T)
      : ((await response.json()) as T);
  }
}

function enc(value: string) {
  return encodeURIComponent(value);
}

/** Re-raises the tenant plugin's error with the same type and message. */
async function toError(response: Response): Promise<Error> {
  if (response.status >= 500) {
    return new ServiceUnavailableError(
      'The organization service is unavailable',
    );
  }
  let name: string | undefined;
  let message = response.statusText;
  try {
    const body = await response.json();
    name = body?.error?.name;
    message = body?.error?.message ?? message;
  } catch {
    // Not JSON
  }
  const ErrorType =
    (name && ERRORS_BY_NAME[name]) ||
    {
      400: InputError,
      401: AuthenticationError,
      403: NotAllowedError,
      404: NotFoundError,
      409: ConflictError,
    }[response.status] ||
    InputError;
  return new ErrorType(message);
}
