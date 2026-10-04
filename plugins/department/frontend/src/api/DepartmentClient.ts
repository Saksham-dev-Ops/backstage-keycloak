import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import {
  AddUserRequest,
  AdminInvite,
  Capability,
  CreateDepartmentResponse,
  AuditLogEntry,
  CreateDepartmentRequest,
  Department,
  DepartmentApiError,
  DepartmentProject,
  DepartmentQuery,
  DepartmentStats,
  DepartmentUser,
  Ministry,
  Page,
  TenantRole,
  UpdateDepartmentRequest,
} from '../types';
import { DepartmentApi } from './DepartmentApi';

/**
 * Talks to the department backend through the discovery and fetch APIs; the
 * fetch API adds the user's Backstage token. Who the caller is and what they
 * may see is decided by the backend from that token alone.
 */
export class DepartmentClient implements DepartmentApi {
  constructor(
    private readonly options: {
      discoveryApi: DiscoveryApi;
      fetchApi: FetchApi;
    },
  ) {}

  getStats() {
    return this.request<DepartmentStats>('/stats');
  }

  listDepartments(query: DepartmentQuery) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        params.set(key, String(value));
      }
    }
    return this.request<Page<Department>>(`/departments?${params}`);
  }

  getDepartment(id: string) {
    return this.request<Department>(departmentPath(id));
  }

  async listCapabilities() {
    return (await this.request<{ items: Capability[] }>('/capabilities')).items;
  }

  async isShortCodeAvailable(shortCode: string) {
    const path = `/short-codes/${encodeURIComponent(shortCode)}`;
    return (await this.request<{ available: boolean }>(path)).available;
  }

  createDepartment(body: CreateDepartmentRequest) {
    return this.request<CreateDepartmentResponse>('/departments', {
      method: 'POST',
      body,
    });
  }

  updateDepartment(id: string, body: UpdateDepartmentRequest) {
    return this.request<Department>(departmentPath(id), {
      method: 'PUT',
      body,
    });
  }

  deleteDepartment(id: string) {
    return this.request<void>(departmentPath(id), { method: 'DELETE' });
  }

  async listUsers(departmentId: string) {
    return (
      await this.request<{ items: DepartmentUser[] }>(
        `${departmentPath(departmentId)}/users`,
      )
    ).items;
  }

  addUser(departmentId: string, body: AddUserRequest) {
    return this.request<DepartmentUser>(
      `${departmentPath(departmentId)}/users`,
      {
        method: 'POST',
        body,
      },
    );
  }

  updateUserRole(departmentId: string, userId: string, role: TenantRole) {
    return this.request<DepartmentUser>(userPath(departmentId, userId), {
      method: 'PUT',
      body: { role },
    });
  }

  removeUser(departmentId: string, userId: string) {
    return this.request<void>(userPath(departmentId, userId), {
      method: 'DELETE',
    });
  }

  createInvite(departmentId: string, userId: string) {
    return this.request<AdminInvite>(
      `${userPath(departmentId, userId)}/invite`,
      { method: 'POST' },
    );
  }

  async listProjects(departmentId: string) {
    const path = `${departmentPath(departmentId)}/projects`;
    return (await this.request<{ items: DepartmentProject[] }>(path)).items;
  }

  async listMinistries() {
    return (await this.request<{ items: Ministry[] }>('/ministries')).items;
  }

  createMinistry(body: { name: string; description?: string }) {
    return this.request<Ministry>('/ministries', { method: 'POST', body });
  }

  updateMinistry(id: string, body: { name?: string; description?: string }) {
    return this.request<Ministry>(`/ministries/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body,
    });
  }

  deleteMinistry(id: string) {
    return this.request<void>(`/ministries/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async listAuditLog(options: { limit?: number; departmentId?: string } = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.departmentId) params.set('departmentId', options.departmentId);
    return (await this.request<{ items: AuditLogEntry[] }>(`/audit?${params}`))
      .items;
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const baseUrl = await this.options.discoveryApi.getBaseUrl('department');
    const response = await this.options.fetchApi.fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers:
        options.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : undefined,
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) {
      let code = 'UNKNOWN_ERROR';
      let message = response.statusText || 'Request failed';
      try {
        const body = await response.json();
        code = body?.error?.code ?? code;
        message = body?.error?.message ?? message;
      } catch {
        // Not JSON
      }
      throw new DepartmentApiError(response.status, code, message);
    }
    return response.status === 204
      ? (undefined as T)
      : ((await response.json()) as T);
  }
}

function departmentPath(id: string) {
  return `/departments/${encodeURIComponent(id)}`;
}

function userPath(departmentId: string, userId: string) {
  return `${departmentPath(departmentId)}/users/${encodeURIComponent(userId)}`;
}
