// @ts-check

/**
 * Project assignments. Owners and admins see every project of their tenant;
 * developers and viewers only the projects they are assigned to.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('project_members', table => {
    table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.primary(['project_id', 'user_id']);
    table.index(['user_id'], 'project_members_user_id_idx');
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTable('project_members');
};
