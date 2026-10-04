import { Knex } from '../knex';
import { AuditLogRepository } from './AuditLogRepository';
import { ConfigurationRepository } from './ConfigurationRepository';
import { EnvironmentRepository } from './EnvironmentRepository';
import { InviteRepository } from './InviteRepository';
import { MembershipRepository } from './MembershipRepository';
import { PlatformRepository } from './PlatformRepository';
import { ProjectMemberRepository } from './ProjectMemberRepository';
import { ProjectRepository } from './ProjectRepository';
import { TenantPluginRepository } from './TenantPluginRepository';
import { TenantRepository } from './TenantRepository';
import { UserRepository } from './UserRepository';

export type Repositories = ReturnType<typeof createRepositories>;

export function createRepositories(db: Knex) {
  return {
    db,
    tenants: new TenantRepository(db),
    tenantPlugins: new TenantPluginRepository(db),
    users: new UserRepository(db),
    invites: new InviteRepository(db),
    memberships: new MembershipRepository(db),
    projects: new ProjectRepository(db),
    projectMembers: new ProjectMemberRepository(db),
    environments: new EnvironmentRepository(db),
    configurations: new ConfigurationRepository(db),
    auditLogs: new AuditLogRepository(db),
    platform: new PlatformRepository(db),
  };
}

export type { ProjectMember } from './ProjectMemberRepository';
export type { AuditAction, AuditEntry, AuditLog } from './AuditLogRepository';
