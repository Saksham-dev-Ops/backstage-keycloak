import { Role } from '../../types';
import { Knex, toIso } from '../knex';

const ADMIN_ROLES: Role[] = ['OWNER', 'ADMIN'];

type Row = Record<string, unknown>;
type Timestamp = string | Date;

/**
 * Platform-wide read queries, across all tenants. Only for platform admins:
 * callers must check that before using this repository.
 */
export class PlatformRepository {
  constructor(private readonly db: Knex) {}

  async counts() {
    const count = async (table: string) =>
      Number((await this.db(table).count({ n: '*' }).first())?.n ?? 0);
    const [tenants, users, projects, environments] = await Promise.all([
      count('tenants'),
      count('users'),
      count('projects'),
      count('environments'),
    ]);
    return { tenants, users, projects, environments };
  }

  async listTenants(options: { tenantId?: string } = {}) {
    const forTenant = (column: string) => (query: { where(c: string, v: string): unknown }) => {
      if (options.tenantId) {
        query.where(column, options.tenantId);
      }
    };
    const [tenants, members, projects, admins] = await Promise.all([
      this.db('tenants').orderBy('name').select().modify(forTenant('id')),
      this.db('user_tenants')
        .groupBy('tenant_id')
        .select('tenant_id')
        .count({ n: '*' })
        .modify(forTenant('tenant_id')),
      this.db('projects')
        .groupBy('tenant_id')
        .select('tenant_id')
        .count({ n: '*' })
        .modify(forTenant('tenant_id')),
      this.db('user_tenants')
          .join('users', 'users.id', 'user_tenants.user_id')
          .whereIn('user_tenants.role', ADMIN_ROLES)
          // Owners first, then by name
          .orderBy([
            { column: 'user_tenants.role', order: 'desc' },
            { column: 'users.name', order: 'asc' },
          ])
          .select(
            'user_tenants.tenant_id',
            'user_tenants.role',
            'users.id',
            'users.email',
            'users.name',
            'users.last_sign_in_at',
          )
          .modify(forTenant('user_tenants.tenant_id')),
    ]);
    const byTenant = (rows: Array<Record<string, unknown>>) =>
      new Map(rows.map(r => [r.tenant_id as string, Number(r.n)]));
    const memberCounts = byTenant(members);
    const projectCounts = byTenant(projects);
    return (tenants as Row[]).map(t => ({
      id: t.id as string,
      name: t.name as string,
      slug: t.slug as string,
      status: t.status as string,
      createdAt: toIso(t.created_at as Timestamp),
      memberCount: memberCounts.get(t.id as string) ?? 0,
      projectCount: projectCounts.get(t.id as string) ?? 0,
      admins: (admins as Row[])
        .filter(a => a.tenant_id === t.id)
        .map(a => ({
          userId: a.id as string,
          email: a.email as string,
          name: a.name as string,
          role: a.role as Role,
          lastSignInAt: a.last_sign_in_at ? toIso(a.last_sign_in_at as Timestamp) : undefined,
        })),
    }));
  }

  /** Members of one tenant, with when they last signed in. */
  async listTenantMembers(tenantId: string) {
    const rows = await this.db('user_tenants')
      .join('users', 'users.id', 'user_tenants.user_id')
      .leftJoin('user_credentials', 'user_credentials.user_id', 'users.id')
      .where('user_tenants.tenant_id', tenantId)
      .orderBy('users.name')
      .select(
        'user_credentials.user_id as credential_user_id',
        'users.id',
        'users.email',
        'users.name',
        'users.last_sign_in_at',
        'user_tenants.role',
        'user_tenants.created_at',
      );
    return rows.map(r => ({
      userId: r.id as string,
      email: r.email as string,
      name: r.name as string,
      role: r.role as Role,
      createdAt: toIso(r.created_at),
      lastSignInAt: r.last_sign_in_at ? toIso(r.last_sign_in_at) : undefined,
      hasPassword: !!r.credential_user_id,
    }));
  }

  async listUsers() {
    const [users, memberships] = await Promise.all([
      this.db('users').orderBy('email').select(),
      this.db('user_tenants')
        .join('tenants', 'tenants.id', 'user_tenants.tenant_id')
        .orderBy('tenants.name')
        .select('user_tenants.user_id', 'user_tenants.role', 'tenants.id', 'tenants.name', 'tenants.slug'),
    ]);
    return users.map(u => ({
      id: u.id as string,
      email: u.email as string,
      name: u.name as string,
      createdAt: toIso(u.created_at),
      memberships: memberships
        .filter(m => m.user_id === u.id)
        .map(m => ({
          tenantId: m.id as string,
          tenantName: m.name as string,
          tenantSlug: m.slug as string,
          role: m.role as Role,
        })),
    }));
  }

  async listProjects(options: { tenantId?: string } = {}) {
    const projectQuery = this.db('projects').join('tenants', 'tenants.id', 'projects.tenant_id');
    if (options.tenantId) {
      projectQuery.where('projects.tenant_id', options.tenantId);
    }
    const [projects, environments, members] = await Promise.all([
      projectQuery
        .orderBy(['tenants.name', 'projects.name'])
        .select('projects.*', 'tenants.name as tenant_name', 'tenants.slug as tenant_slug'),
      this.db('environments').groupBy('project_id').select('project_id').count({ n: '*' }),
      this.db('project_members').groupBy('project_id').select('project_id').count({ n: '*' }),
    ]);
    const byProject = (rows: Array<Record<string, unknown>>) =>
      new Map(rows.map(r => [r.project_id as string, Number(r.n)]));
    const envCounts = byProject(environments);
    const memberCounts = byProject(members);
    return projects.map(p => ({
      id: p.id as string,
      name: p.name as string,
      slug: p.slug as string,
      description: (p.description as string | null) ?? undefined,
      tenantId: p.tenant_id as string,
      tenantName: p.tenant_name as string,
      tenantSlug: p.tenant_slug as string,
      environmentCount: envCounts.get(p.id) ?? 0,
      assignedMemberCount: memberCounts.get(p.id) ?? 0,
      updatedAt: toIso(p.updated_at),
    }));
  }
}
