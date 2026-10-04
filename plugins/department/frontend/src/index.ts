/**
 * Departments, ministries and the audit log of the platform admin console.
 */
export { departmentPlugin as default, departmentPlugin } from './plugin';
export { departmentApiRef, type DepartmentApi } from './api/DepartmentApi';
export { DepartmentClient } from './api/DepartmentClient';
export * from './types';
