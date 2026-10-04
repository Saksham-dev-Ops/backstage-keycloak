// @ts-check

/**
 * Multi-step department onboarding: what a department can use, the
 * permissions of its admins, and the admins' contact details.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('departments', table => {
    table
      .boolean('admins_can_approve_join_requests')
      .notNullable()
      .defaultTo(false);
    table
      .boolean('admins_can_create_custom_roles')
      .notNullable()
      .defaultTo(false);
  });

  // One row per enabled capability. A department without rows predates this
  // table and keeps every capability.
  await knex.schema.createTable('department_capabilities', table => {
    table
      .uuid('tenant_id')
      .notNullable()
      .references('tenant_id')
      .inTable('departments')
      .onDelete('CASCADE');
    table.string('capability_id', 64).notNullable();
    table.primary(['tenant_id', 'capability_id']);
  });

  // Designation and mobile of department admins; the tenant plugin only
  // knows their name and email
  await knex.schema.createTable('department_admin_profiles', table => {
    table
      .uuid('tenant_id')
      .notNullable()
      .references('tenant_id')
      .inTable('departments')
      .onDelete('CASCADE');
    table.string('email', 320).notNullable();
    table.string('designation', 255).notNullable();
    table.string('mobile', 32).notNullable();
    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp('updated_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.primary(['tenant_id', 'email']);
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTable('department_admin_profiles');
  await knex.schema.dropTable('department_capabilities');
  await knex.schema.alterTable('departments', table => {
    table.dropColumn('admins_can_approve_join_requests');
    table.dropColumn('admins_can_create_custom_roles');
  });
};
