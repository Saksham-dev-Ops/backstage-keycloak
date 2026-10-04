// @ts-check

/**
 * Departments are the tenants of the tenant plugin. This plugin stores what
 * the tenant plugin does not know about them: the ministry they belong to and
 * their user and project limits. `departments.tenant_id` is the tenant's id.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const timestamps = (
    /** @type {import('knex').Knex.CreateTableBuilder} */ table,
  ) => {
    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table
      .timestamp('updated_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
  };

  await knex.schema.createTable('ministries', table => {
    table.uuid('id').primary();
    table.string('name', 255).notNullable().unique();
    table.string('slug', 63).notNullable().unique();
    table.text('description');
    timestamps(table);
  });

  await knex.schema.createTable('departments', table => {
    // One profile per tenant; also the tenant isolation key
    table.uuid('tenant_id').primary();
    // Restrict: a ministry with departments cannot be deleted
    table
      .uuid('ministry_id')
      .references('id')
      .inTable('ministries')
      .onDelete('RESTRICT');
    // Null means unlimited
    table.integer('user_limit');
    table.integer('project_limit');
    table.uuid('created_by');
    timestamps(table);
    table.index(['ministry_id'], 'departments_ministry_id_idx');
  });

  // No foreign keys: audit entries must outlive the rows they describe
  await knex.schema.createTable('department_audit_logs', table => {
    table.uuid('id').primary();
    table.uuid('tenant_id');
    table.uuid('actor_user_id');
    table.string('actor_email', 320);
    table.string('action', 64).notNullable();
    table.string('resource_type', 64).notNullable();
    table.string('resource_id', 255);
    table.text('metadata');
    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.index(['created_at'], 'department_audit_logs_created_idx');
    table.index(
      ['tenant_id', 'created_at'],
      'department_audit_logs_tenant_created_idx',
    );
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTable('department_audit_logs');
  await knex.schema.dropTable('departments');
  await knex.schema.dropTable('ministries');
};
