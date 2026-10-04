import {
  createApiRef,
  DiscoveryApi,
  FetchApi,
} from '@backstage/core-plugin-api';

export type Role = 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'VIEWER';
export const ROLES: Role[] = ['OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER'];

export type Permission =
  | 'tenant.manage'
  | 'member.read'
  | 'member.manage'
  | 'project.read'
  | 'project.read.all'
  | 'project.create'
  | 'project.update'
  | 'project.delete'
  | 'environment.manage'
  | 'config.read'
  | 'config.write'
  | 'secret.read'
  | 'secret.write'
  | 'audit.read'
  | 'plugin.manage';

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export type TenantMembership = Tenant & { role: Role };

export type CurrentTenant = {
  tenant: Tenant;
  role: Role;
  permissions: Permission[];
};

/** A plugin that each organization can turn on or off. */
export type TenantPlugin = {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
};

export type User = { id: string; email: string; name: string };

export type Member = {
  userId: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
};

export type Environment = { id: string; projectId: string; name: string; createdAt: string };

export type Project = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectSummary = Project & { environmentCount: number };

/** A tenant member assigned to a project */
export type ProjectMember = {
  userId: string;
  email: string;
  name: string;
  role: Role;
  assignedAt: string;
};

// --- Platform admin views, across all organizations ---------------------------

export type PlatformOverview = {
  tenants: number;
  users: number;
  projects: number;
  environments: number;
};

export type PlatformTenant = Tenant & {
  createdAt: string;
  memberCount: number;
  projectCount: number;
};

export type PlatformUser = User & {
  createdAt: string;
  isPlatformAdmin: boolean;
  memberships: Array<{ tenantId: string; tenantName: string; tenantSlug: string; role: Role }>;
};

export type PlatformProject = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  environmentCount: number;
  assignedMemberCount: number;
  updatedAt: string;
};
export type ProjectDetails = Project & { environments: Environment[] };

export type ConfigEntry = {
  id: string;
  environmentId: string;
  key: string;
  /** Always null for secrets */
  value: string | null;
  isSecret: boolean;
  updatedAt: string;
};

export type AuditLog = {
  id: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type CreateTenantRequest = {
  name: string;
  slug: string;
  ownerEmail?: string;
  ownerName?: string;
  ownerPassword?: string;
};

export type CreateTenantResponse = {
  tenant: Tenant;
  owner: { userId: string; email: string; accountCreated: boolean };
};

export type TenantState = {
  loading: boolean;
  error?: Error;
  user?: User;
  isPlatformAdmin: boolean;
  tenants: TenantMembership[];
  /** Undefined until the user has chosen a tenant */
  current?: CurrentTenant;
  /** Plugin switches of the current tenant */
  plugins: TenantPlugin[];
};

/**
 * Client-side tenant context. The selected tenant id is sent as the
 * `x-tenant-id` header; the backend re-validates membership on every call, so
 * the stored selection is a preference, not an authorization decision.
 */
export interface TenantApi {
  getState(): TenantState;
  subscribe(listener: (state: TenantState) => void): () => void;
  reload(): Promise<void>;
  switchTenant(tenantId: string): Promise<void>;

  updateTenant(body: { name: string }): Promise<Tenant>;
  createTenant(body: CreateTenantRequest): Promise<CreateTenantResponse>;
  listAuditLogs(): Promise<AuditLog[]>;

  listPlugins(): Promise<TenantPlugin[]>;
  setPluginEnabled(pluginId: string, enabled: boolean): Promise<TenantPlugin>;

  listMembers(): Promise<Member[]>;
  addMember(body: { email: string; name?: string; role: Role; password?: string }): Promise<Member>;
  updateMemberRole(userId: string, role: Role): Promise<Member>;
  removeMember(userId: string): Promise<void>;

  listProjects(): Promise<ProjectSummary[]>;
  getProject(projectId: string): Promise<ProjectDetails>;
  createProject(body: {
    name: string;
    slug: string;
    description?: string;
    environments?: string[];
  }): Promise<ProjectDetails>;
  updateProject(projectId: string, body: { name?: string; description?: string }): Promise<ProjectDetails>;
  deleteProject(projectId: string): Promise<void>;

  listProjectMembers(projectId: string): Promise<ProjectMember[]>;
  assignProjectMember(projectId: string, userId: string): Promise<ProjectMember[]>;
  unassignProjectMember(projectId: string, userId: string): Promise<void>;

  getPlatformOverview(): Promise<PlatformOverview>;
  listPlatformTenants(): Promise<PlatformTenant[]>;
  listPlatformUsers(): Promise<PlatformUser[]>;
  listPlatformProjects(): Promise<PlatformProject[]>;

  createEnvironment(projectId: string, name: string): Promise<Environment>;
  deleteEnvironment(projectId: string, environmentId: string): Promise<void>;

  listConfig(projectId: string, environmentId: string): Promise<ConfigEntry[]>;
  createConfig(
    projectId: string,
    body: { environmentId: string; key: string; value: string; isSecret: boolean },
  ): Promise<ConfigEntry>;
  updateConfig(projectId: string, configId: string, body: { key?: string; value?: string }): Promise<ConfigEntry>;
  deleteConfig(projectId: string, configId: string): Promise<void>;
  revealSecret(projectId: string, configId: string): Promise<string>;
}

export const tenantApiRef = createApiRef<TenantApi>({ id: 'plugin.tenant.api' });

let currentTenantId: string | undefined;

/**
 * The selected tenant, read by the fetch middleware that sends it to every
 * backend plugin as the `x-tenant-id` header.
 */
export function getCurrentTenantId() {
  return currentTenantId;
}

export const TENANT_PREFERENCE_KEY = 'tenant:current-tenant-id';

export function readTenantPreference(): string | undefined {
  try {
    return window.localStorage.getItem(TENANT_PREFERENCE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function writeTenantPreference(tenantId: string) {
  try {
    window.localStorage.setItem(TENANT_PREFERENCE_KEY, tenantId);
  } catch {
    // Only a convenience; the user is asked again next time
  }
}

export async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body?.error?.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

export class TenantClient implements TenantApi {
  private state: TenantState = {
    loading: true,
    isPlatformAdmin: false,
    tenants: [],
    plugins: [],
  };
  private readonly listeners = new Set<(state: TenantState) => void>();
  private loaded?: Promise<void>;

  constructor(
    private readonly options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi },
  ) {}

  getState() {
    if (!this.loaded) {
      this.loaded = this.reload();
    }
    return this.state;
  }

  subscribe(listener: (state: TenantState) => void) {
    this.listeners.add(listener);
    this.getState();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(changes: Partial<TenantState>) {
    this.state = { ...this.state, ...changes };
    currentTenantId = this.state.current?.tenant.id;
    this.listeners.forEach(listener => listener(this.state));
  }

  async reload() {
    this.setState({ loading: true, error: undefined });
    try {
      const me = await this.request<{
        user: User;
        isPlatformAdmin: boolean;
        tenants: TenantMembership[];
      }>('/me', { tenantScoped: false });
      const preferred = readTenantPreference();
      const selected =
        me.tenants.find(t => t.id === preferred) ??
        (me.tenants.length === 1 ? me.tenants[0] : undefined);
      const [current, plugins] = selected
        ? await Promise.all([
            this.request<CurrentTenant>('/current', { tenantId: selected.id }),
            this.fetchPlugins(selected.id),
          ])
        : [undefined, []];
      this.setState({ loading: false, ...me, current, plugins });
    } catch (error) {
      this.setState({ loading: false, error: error as Error });
    }
  }

  async switchTenant(tenantId: string) {
    // The backend re-validates membership and audits the switch
    const current = await this.request<CurrentTenant>('/switch', {
      method: 'POST',
      body: { tenantId },
      tenantScoped: false,
    });
    writeTenantPreference(current.tenant.id);
    const plugins = await this.fetchPlugins(current.tenant.id);
    this.setState({ current, plugins });
  }

  private async fetchPlugins(tenantId: string) {
    return (await this.request<{ items: TenantPlugin[] }>('/plugins', { tenantId })).items;
  }

  async listPlugins() {
    return (await this.request<{ items: TenantPlugin[] }>('/plugins')).items;
  }

  async setPluginEnabled(pluginId: string, enabled: boolean) {
    const plugin = await this.request<TenantPlugin>(`/plugins/${encodeURIComponent(pluginId)}`, {
      method: 'PUT',
      body: { enabled },
    });
    // Keep the sidebar and route guard in sync
    this.setState({
      plugins: this.state.plugins.map(p => (p.id === plugin.id ? plugin : p)),
    });
    return plugin;
  }

  updateTenant(body: { name: string }) {
    return this.request<Tenant>('/current', { method: 'PATCH', body });
  }

  createTenant(body: CreateTenantRequest) {
    return this.request<CreateTenantResponse>('/tenants', {
      method: 'POST',
      body,
      tenantScoped: false,
    });
  }

  async listAuditLogs() {
    return (await this.request<{ items: AuditLog[] }>('/audit')).items;
  }

  async listMembers() {
    return (await this.request<{ items: Member[] }>('/members')).items;
  }

  addMember(body: { email: string; name?: string; role: Role; password?: string }) {
    return this.request<Member>('/members', { method: 'POST', body });
  }

  updateMemberRole(userId: string, role: Role) {
    return this.request<Member>(`/members/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: { role },
    });
  }

  removeMember(userId: string) {
    return this.request<void>(`/members/${encodeURIComponent(userId)}`, { method: 'DELETE' });
  }

  async listProjects() {
    return (await this.request<{ items: ProjectSummary[] }>('/projects')).items;
  }

  getProject(projectId: string) {
    return this.request<ProjectDetails>(projectPath(projectId));
  }

  createProject(body: { name: string; slug: string; description?: string; environments?: string[] }) {
    return this.request<ProjectDetails>('/projects', { method: 'POST', body });
  }

  updateProject(projectId: string, body: { name?: string; description?: string }) {
    return this.request<ProjectDetails>(projectPath(projectId), { method: 'PATCH', body });
  }

  deleteProject(projectId: string) {
    return this.request<void>(projectPath(projectId), { method: 'DELETE' });
  }

  async listProjectMembers(projectId: string) {
    return (await this.request<{ items: ProjectMember[] }>(`${projectPath(projectId)}/members`))
      .items;
  }

  async assignProjectMember(projectId: string, userId: string) {
    const path = `${projectPath(projectId)}/members/${encodeURIComponent(userId)}`;
    return (await this.request<{ items: ProjectMember[] }>(path, { method: 'PUT' })).items;
  }

  unassignProjectMember(projectId: string, userId: string) {
    const path = `${projectPath(projectId)}/members/${encodeURIComponent(userId)}`;
    return this.request<void>(path, { method: 'DELETE' });
  }

  getPlatformOverview() {
    return this.request<PlatformOverview>('/admin/overview', { tenantScoped: false });
  }

  async listPlatformTenants() {
    return (
      await this.request<{ items: PlatformTenant[] }>('/admin/tenants', { tenantScoped: false })
    ).items;
  }

  async listPlatformUsers() {
    return (
      await this.request<{ items: PlatformUser[] }>('/admin/users', { tenantScoped: false })
    ).items;
  }

  async listPlatformProjects() {
    return (
      await this.request<{ items: PlatformProject[] }>('/admin/projects', { tenantScoped: false })
    ).items;
  }

  createEnvironment(projectId: string, name: string) {
    return this.request<Environment>(`${projectPath(projectId)}/environments`, {
      method: 'POST',
      body: { name },
    });
  }

  deleteEnvironment(projectId: string, environmentId: string) {
    return this.request<void>(
      `${projectPath(projectId)}/environments/${encodeURIComponent(environmentId)}`,
      { method: 'DELETE' },
    );
  }

  async listConfig(projectId: string, environmentId: string) {
    const query = new URLSearchParams({ environmentId });
    return (
      await this.request<{ items: ConfigEntry[] }>(`${projectPath(projectId)}/config?${query}`)
    ).items;
  }

  createConfig(
    projectId: string,
    body: { environmentId: string; key: string; value: string; isSecret: boolean },
  ) {
    return this.request<ConfigEntry>(`${projectPath(projectId)}/config`, { method: 'POST', body });
  }

  updateConfig(projectId: string, configId: string, body: { key?: string; value?: string }) {
    return this.request<ConfigEntry>(configPath(projectId, configId), { method: 'PATCH', body });
  }

  deleteConfig(projectId: string, configId: string) {
    return this.request<void>(configPath(projectId, configId), { method: 'DELETE' });
  }

  async revealSecret(projectId: string, configId: string) {
    const secret = await this.request<{ value: string }>(
      `${configPath(projectId, configId)}/secret`,
    );
    return secret.value;
  }

  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      tenantScoped?: boolean;
      tenantId?: string;
    } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (options.tenantScoped !== false) {
      const tenantId = options.tenantId ?? this.state.current?.tenant.id;
      if (!tenantId) {
        throw new Error('No organization selected');
      }
      headers['x-tenant-id'] = tenantId;
    }
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    const baseUrl = await this.options.discoveryApi.getBaseUrl('tenant');
    const response = await this.options.fetchApi.fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }
    return response.status === 204 ? (undefined as T) : response.json();
  }
}

function projectPath(projectId: string) {
  return `/projects/${encodeURIComponent(projectId)}`;
}

function configPath(projectId: string, configId: string) {
  return `${projectPath(projectId)}/config/${encodeURIComponent(configId)}`;
}
