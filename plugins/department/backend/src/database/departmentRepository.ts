import { Knex, toIso } from './knex';

/** What this plugin stores about a department (a tenant). */
export type DepartmentProfile = {
  tenantId: string;
  ministryId?: string;
  userLimit?: number;
  projectLimit?: number;
  adminsCanApproveJoinRequests: boolean;
  adminsCanCreateCustomRoles: boolean;
  /** Enabled capability ids; undefined for departments from before capabilities */
  capabilities?: string[];
  createdAt: string;
  updatedAt: string;
};

export type AdminProfile = {
  email: string;
  designation: string;
  mobile: string;
};

type DepartmentRow = {
  tenant_id: string;
  ministry_id: string | null;
  user_limit: number | null;
  project_limit: number | null;
  admins_can_approve_join_requests: boolean | number;
  admins_can_create_custom_roles: boolean | number;
  created_at: string | Date;
  updated_at: string | Date;
};

function toProfile(
  row: DepartmentRow,
  capabilities?: string[],
): DepartmentProfile {
  return {
    tenantId: row.tenant_id,
    ministryId: row.ministry_id ?? undefined,
    userLimit: row.user_limit ?? undefined,
    projectLimit: row.project_limit ?? undefined,
    // SQLite returns booleans as 0/1
    adminsCanApproveJoinRequests: !!row.admins_can_approve_join_requests,
    adminsCanCreateCustomRoles: !!row.admins_can_create_custom_roles,
    capabilities,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export type ProfileChanges = {
  ministryId?: string;
  /** null removes the limit */
  userLimit?: number | null;
  projectLimit?: number | null;
};

export type NewDepartmentDetails = {
  ministryId: string;
  userLimit: number;
  projectLimit: number;
  adminsCanApproveJoinRequests: boolean;
  adminsCanCreateCustomRoles: boolean;
  capabilities: string[];
  admins: AdminProfile[];
};

/** Stay well below the bind parameter limits of SQLite and PostgreSQL */
const CHUNK = 500;

/**
 * Every query is keyed by tenant id; there is no lookup that could return
 * another tenant's row. Listing all profiles is for platform admins only.
 */
export class DepartmentRepository {
  constructor(private readonly db: Knex) {}

  async get(tenantId: string): Promise<DepartmentProfile | undefined> {
    return (await this.listForTenants([tenantId])).get(tenantId);
  }

  /** Profiles of the given tenants only. */
  async listForTenants(
    tenantIds: string[],
  ): Promise<Map<string, DepartmentProfile>> {
    const rows: DepartmentRow[] = [];
    const capabilityRows: Array<{ tenant_id: string; capability_id: string }> =
      [];
    for (let i = 0; i < tenantIds.length; i += CHUNK) {
      const ids = tenantIds.slice(i, i + CHUNK);
      const [departments, capabilities] = await Promise.all([
        this.db<DepartmentRow>('departments').whereIn('tenant_id', ids),
        this.db('department_capabilities')
          .whereIn('tenant_id', ids)
          .orderBy('capability_id'),
      ]);
      rows.push(...departments);
      capabilityRows.push(...capabilities);
    }
    const capabilities = new Map<string, string[]>();
    for (const row of capabilityRows) {
      capabilities.set(row.tenant_id, [
        ...(capabilities.get(row.tenant_id) ?? []),
        row.capability_id,
      ]);
    }
    return new Map(
      rows.map(row => [
        row.tenant_id,
        toProfile(row, capabilities.get(row.tenant_id)),
      ]),
    );
  }

  /** Stores everything the onboarding form collected, in one transaction. */
  async create(
    tenantId: string,
    details: NewDepartmentDetails,
    createdBy: string,
  ) {
    await this.db.transaction(async tx => {
      await tx('departments').insert({
        tenant_id: tenantId,
        ministry_id: details.ministryId,
        user_limit: details.userLimit,
        project_limit: details.projectLimit,
        admins_can_approve_join_requests: details.adminsCanApproveJoinRequests,
        admins_can_create_custom_roles: details.adminsCanCreateCustomRoles,
        created_by: createdBy,
      });
      await tx('department_capabilities').insert(
        details.capabilities.map(id => ({
          tenant_id: tenantId,
          capability_id: id,
        })),
      );
      if (details.admins.length) {
        await tx('department_admin_profiles').insert(
          details.admins.map(a => ({ tenant_id: tenantId, ...a })),
        );
      }
    });
  }

  /** Creates or updates a profile atomically; only the given fields change. */
  async upsert(tenantId: string, changes: ProfileChanges, createdBy?: string) {
    const values: Record<string, unknown> = {};
    if (changes.ministryId !== undefined)
      values.ministry_id = changes.ministryId;
    if (changes.userLimit !== undefined) values.user_limit = changes.userLimit;
    if (changes.projectLimit !== undefined)
      values.project_limit = changes.projectLimit;
    await this.db('departments')
      .insert({ tenant_id: tenantId, created_by: createdBy ?? null, ...values })
      .onConflict('tenant_id')
      .merge({ ...values, updated_at: this.db.fn.now() });
  }

  /** Creates a profile unless one exists; never overwrites (used for seeding). */
  async insertIfMissing(tenantId: string, changes: ProfileChanges) {
    await this.db('departments')
      .insert({
        tenant_id: tenantId,
        ministry_id: changes.ministryId ?? null,
        user_limit: changes.userLimit ?? null,
        project_limit: changes.projectLimit ?? null,
      })
      .onConflict('tenant_id')
      .ignore();
  }

  /** Designations and mobiles of the department's admins, by email. */
  async listAdminProfiles(
    tenantId: string,
  ): Promise<Map<string, AdminProfile>> {
    const rows = await this.db('department_admin_profiles')
      .where({ tenant_id: tenantId })
      .select('email', 'designation', 'mobile');
    return new Map(
      rows.map(r => [
        r.email,
        { email: r.email, designation: r.designation, mobile: r.mobile },
      ]),
    );
  }

  async upsertAdminProfile(tenantId: string, profile: AdminProfile) {
    await this.db('department_admin_profiles')
      .insert({ tenant_id: tenantId, ...profile })
      .onConflict(['tenant_id', 'email'])
      .merge({
        designation: profile.designation,
        mobile: profile.mobile,
        updated_at: this.db.fn.now(),
      });
  }

  async deleteAdminProfile(tenantId: string, email: string) {
    await this.db('department_admin_profiles')
      .where({ tenant_id: tenantId, email })
      .delete();
  }

  async delete(tenantId: string) {
    await this.db.transaction(async tx => {
      // Explicit deletes so this does not depend on FK cascades being enabled
      await tx('department_admin_profiles')
        .where({ tenant_id: tenantId })
        .delete();
      await tx('department_capabilities')
        .where({ tenant_id: tenantId })
        .delete();
      await tx('departments').where({ tenant_id: tenantId }).delete();
    });
  }
}
