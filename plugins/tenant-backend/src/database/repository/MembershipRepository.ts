import { randomUUID } from 'node:crypto';
import { Member, Role, Tenant } from '../../types';
import { Knex, toIso } from '../knex';
import { toTenant } from './TenantRepository';

type MemberRow = {
  id: string;
  user_id: string;
  tenant_id: string;
  role: Role;
  created_at: string | Date;
  email: string;
  name: string;
};

function toMember(row: MemberRow): Member {
  return {
    id: row.id,
    userId: row.user_id,
    tenantId: row.tenant_id,
    role: row.role,
    createdAt: toIso(row.created_at),
    email: row.email,
    name: row.name,
  };
}

const MEMBER_COLUMNS = [
  'user_tenants.id',
  'user_tenants.user_id',
  'user_tenants.tenant_id',
  'user_tenants.role',
  'user_tenants.created_at',
  'users.email',
  'users.name',
];

export class MembershipRepository {
  constructor(private readonly db: Knex) {}

  /** All tenants the user belongs to, with the user's role in each. */
  async listTenantsForUser(
    userId: string,
  ): Promise<Array<{ tenant: Tenant; role: Role }>> {
    const rows = await this.db('user_tenants')
      .join('tenants', 'tenants.id', 'user_tenants.tenant_id')
      .where('user_tenants.user_id', userId)
      .orderBy('tenants.name')
      .select('tenants.*', 'user_tenants.role as membership_role');
    return rows.map(row => ({ tenant: toTenant(row), role: row.membership_role }));
  }

  async getRole(tenantId: string, userId: string): Promise<Role | undefined> {
    const row = await this.db('user_tenants')
      .where({ tenant_id: tenantId, user_id: userId })
      .first('role');
    return row?.role;
  }

  async listMembers(tenantId: string): Promise<Member[]> {
    const rows = await this.db('user_tenants')
      .join('users', 'users.id', 'user_tenants.user_id')
      .where('user_tenants.tenant_id', tenantId)
      .orderBy('users.email')
      .select(MEMBER_COLUMNS);
    return rows.map(toMember);
  }

  async countMembers(tenantId: string): Promise<number> {
    const row = await this.db('user_tenants')
      .where({ tenant_id: tenantId })
      .count({ n: '*' })
      .first();
    return Number(row?.n ?? 0);
  }

  async getMember(tenantId: string, userId: string): Promise<Member | undefined> {
    const row = await this.db('user_tenants')
      .join('users', 'users.id', 'user_tenants.user_id')
      .where({
        'user_tenants.tenant_id': tenantId,
        'user_tenants.user_id': userId,
      })
      .first(MEMBER_COLUMNS);
    return row ? toMember(row) : undefined;
  }

  async add(tenantId: string, userId: string, role: Role, tx: Knex = this.db) {
    await tx('user_tenants').insert({
      id: randomUUID(),
      tenant_id: tenantId,
      user_id: userId,
      role,
    });
  }

  async updateRole(tenantId: string, userId: string, role: Role) {
    return this.db('user_tenants')
      .where({ tenant_id: tenantId, user_id: userId })
      .update({ role });
  }

  async remove(tenantId: string, userId: string) {
    return this.db('user_tenants')
      .where({ tenant_id: tenantId, user_id: userId })
      .delete();
  }
}
