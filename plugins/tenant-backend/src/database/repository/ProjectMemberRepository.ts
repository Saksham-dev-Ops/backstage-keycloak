import { Role } from '../../types';
import { Knex, toIso } from '../knex';

export type ProjectMember = {
  userId: string;
  email: string;
  name: string;
  role: Role;
  assignedAt: string;
};

/** Assignments of tenant members to projects; always scoped by tenant id. */
export class ProjectMemberRepository {
  constructor(private readonly db: Knex) {}

  async list(tenantId: string, projectId: string): Promise<ProjectMember[]> {
    const rows = await this.db('project_members')
      .join('projects', 'projects.id', 'project_members.project_id')
      .join('users', 'users.id', 'project_members.user_id')
      .join('user_tenants', function joinMembership() {
        this.on('user_tenants.user_id', '=', 'project_members.user_id').andOn(
          'user_tenants.tenant_id',
          '=',
          'projects.tenant_id',
        );
      })
      .where({ 'projects.tenant_id': tenantId, 'projects.id': projectId })
      .orderBy('users.email')
      .select(
        'users.id as user_id',
        'users.email',
        'users.name',
        'user_tenants.role',
        'project_members.created_at',
      );
    return rows.map(row => ({
      userId: row.user_id,
      email: row.email,
      name: row.name,
      role: row.role,
      assignedAt: toIso(row.created_at),
    }));
  }

  async isMember(projectId: string, userId: string): Promise<boolean> {
    const row = await this.db('project_members')
      .where({ project_id: projectId, user_id: userId })
      .first('user_id');
    return !!row;
  }

  async add(projectId: string, userId: string, tx: Knex = this.db) {
    await tx('project_members')
      .insert({ project_id: projectId, user_id: userId })
      .onConflict(['project_id', 'user_id'])
      .ignore();
  }

  async remove(projectId: string, userId: string) {
    return this.db('project_members').where({ project_id: projectId, user_id: userId }).delete();
  }

  /** Removes all project assignments of a user within one tenant. */
  async removeUserFromTenant(tenantId: string, userId: string) {
    return this.db('project_members')
      .where('user_id', userId)
      .whereIn('project_id', this.db('projects').where('tenant_id', tenantId).select('id'))
      .delete();
  }
}
