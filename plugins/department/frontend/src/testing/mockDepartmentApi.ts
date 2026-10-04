import { DepartmentApi } from '../api/DepartmentApi';
import { Capability, Department, Ministry, Page } from '../types';

/** Test data and a mock of the department API, for component tests. */
export const ministry: Ministry = {
  id: 'm1',
  name: 'Ministry of Electronics and Information Technology',
  slug: 'meity',
  departmentCount: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

export const capabilities: Capability[] = [
  {
    id: 'project-management',
    title: 'Project management',
    description: 'Plan and track work',
    included: ['OpenProject'],
    comingSoon: ['Jira'],
  },
  {
    id: 'documentation',
    title: 'Documentation',
    description: 'Guides and shared documents',
    included: ['TechDocs'],
    comingSoon: ['SharePoint links'],
  },
];

export const department: Department = {
  id: 'd1',
  name: 'Department of Military Affairs',
  slug: 'dma',
  shortCode: 'DMA',
  status: 'active',
  ministry: { id: 'm1', name: 'Ministry of Defence' },
  admins: [
    {
      userId: 'u1',
      name: 'Siddharth Kuradia',
      email: 's@example.com',
      role: 'OWNER',
      hasSignedIn: true,
    },
    {
      userId: 'u2',
      name: 'Asha Rao',
      email: 'a@example.com',
      role: 'ADMIN',
      hasSignedIn: false,
    },
  ],
  userCount: 84,
  projectCount: 10,
  userLimit: 500,
  projectLimit: 50,
  capabilities: ['project-management', 'documentation'],
  adminsCanApproveJoinRequests: true,
  adminsCanCreateCustomRoles: false,
  createdAt: '2026-01-01T00:00:00Z',
  callerRole: 'PLATFORM_ADMIN',
};

export const page = (items: Department[]): Page<Department> => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 10,
});

export function mockDepartmentApi(
  overrides: Partial<DepartmentApi> = {},
): DepartmentApi {
  return {
    getStats: jest
      .fn()
      .mockResolvedValue({
        total: 36,
        active: 31,
        invitePending: 3,
        noAdmin: 2,
        suspended: 0,
      }),
    listDepartments: jest.fn().mockResolvedValue(page([department])),
    listMinistries: jest.fn().mockResolvedValue([ministry]),
    listCapabilities: jest.fn().mockResolvedValue(capabilities),
    isShortCodeAvailable: jest.fn().mockResolvedValue(true),
    getDepartment: jest.fn().mockResolvedValue(department),
    createDepartment: jest.fn().mockResolvedValue({ department, invites: [] }),
    updateDepartment: jest.fn().mockResolvedValue(department),
    deleteDepartment: jest.fn().mockResolvedValue(undefined),
    listUsers: jest.fn().mockResolvedValue([]),
    addUser: jest.fn(),
    updateUserRole: jest.fn(),
    removeUser: jest.fn(),
    createInvite: jest.fn(),
    listProjects: jest.fn().mockResolvedValue([]),
    createMinistry: jest.fn(),
    updateMinistry: jest.fn(),
    deleteMinistry: jest.fn(),
    listAuditLog: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}
