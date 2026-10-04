import { createApiRef } from '@backstage/core-plugin-api';
import {
  AddUserRequest,
  AdminInvite,
  Capability,
  CreateDepartmentResponse,
  AuditLogEntry,
  CreateDepartmentRequest,
  Department,
  DepartmentProject,
  DepartmentQuery,
  DepartmentStats,
  DepartmentUser,
  Ministry,
  Page,
  TenantRole,
  UpdateDepartmentRequest,
} from '../types';

/** The department backend (`/api/department`). */
export interface DepartmentApi {
  getStats(): Promise<DepartmentStats>;
  listDepartments(query: DepartmentQuery): Promise<Page<Department>>;
  getDepartment(id: string): Promise<Department>;
  listCapabilities(): Promise<Capability[]>;
  isShortCodeAvailable(shortCode: string): Promise<boolean>;
  createDepartment(
    body: CreateDepartmentRequest,
  ): Promise<CreateDepartmentResponse>;
  updateDepartment(
    id: string,
    body: UpdateDepartmentRequest,
  ): Promise<Department>;
  deleteDepartment(id: string): Promise<void>;

  listUsers(departmentId: string): Promise<DepartmentUser[]>;
  addUser(departmentId: string, body: AddUserRequest): Promise<DepartmentUser>;
  updateUserRole(
    departmentId: string,
    userId: string,
    role: TenantRole,
  ): Promise<DepartmentUser>;
  removeUser(departmentId: string, userId: string): Promise<void>;
  createInvite(departmentId: string, userId: string): Promise<AdminInvite>;

  listProjects(departmentId: string): Promise<DepartmentProject[]>;

  listMinistries(): Promise<Ministry[]>;
  createMinistry(body: {
    name: string;
    description?: string;
  }): Promise<Ministry>;
  updateMinistry(
    id: string,
    body: { name?: string; description?: string },
  ): Promise<Ministry>;
  deleteMinistry(id: string): Promise<void>;

  listAuditLog(options?: {
    limit?: number;
    departmentId?: string;
  }): Promise<AuditLogEntry[]>;
}

export const departmentApiRef = createApiRef<DepartmentApi>({
  id: 'plugin.department.api',
});
