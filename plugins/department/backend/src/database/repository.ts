import { AuditRepository } from './auditRepository';
import { DepartmentRepository } from './departmentRepository';
import { Knex } from './knex';
import { MinistryRepository } from './ministryRepository';

export type Repositories = ReturnType<typeof createRepositories>;

export function createRepositories(db: Knex) {
  return {
    db,
    ministries: new MinistryRepository(db),
    departments: new DepartmentRepository(db),
    audit: new AuditRepository(db),
  };
}
