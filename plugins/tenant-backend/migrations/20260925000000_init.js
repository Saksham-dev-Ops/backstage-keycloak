// @ts-check

/**
 * Multi-tenant schema. Every tenant-owned row can be traced back to exactly
 * one tenant: projects directly, environments and configurations through
 * their project.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const timestamps = (/** @type {import('knex').Knex.CreateTableBuilder} */ table) => {
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  };

  await knex.schema.createTable('tenants', table => {
    table.uuid('id').primary();
    table.string('name', 255).notNullable();
    table.string('slug', 63).notNullable().unique();
    table.string('status', 16).notNullable().defaultTo('active');
    timestamps(table);
  });

  await knex.schema.createTable('users', table => {
    table.uuid('id').primary();
    // Always stored lower-cased
    table.string('email', 320).notNullable().unique();
    table.string('name', 255).notNullable();
    timestamps(table);
  });

  // Only used by the local email/password sign-in provider
  await knex.schema.createTable('user_credentials', table => {
    table.uuid('user_id').primary().references('id').inTable('users').onDelete('CASCADE');
    table.string('password_hash', 255).notNullable();
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('user_tenants', table => {
    table.uuid('id').primary();
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('role', 16).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['user_id', 'tenant_id']);
    table.index(['user_id'], 'user_tenants_user_id_idx');
    table.index(['tenant_id'], 'user_tenants_tenant_id_idx');
  });

  await knex.schema.createTable('projects', table => {
    table.uuid('id').primary();
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.string('slug', 63).notNullable();
    table.text('description');
    timestamps(table);
    // Slugs are unique per tenant, not globally
    table.unique(['tenant_id', 'slug']);
    table.index(['tenant_id'], 'projects_tenant_id_idx');
  });

  await knex.schema.createTable('environments', table => {
    table.uuid('id').primary();
    table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.string('name', 63).notNullable();
    timestamps(table);
    table.unique(['project_id', 'name']);
    // Target of the composite foreign key from configurations
    table.unique(['project_id', 'id']);
    table.index(['project_id'], 'environments_project_id_idx');
  });

  await knex.schema.createTable('configurations', table => {
    table.uuid('id').primary();
    table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.uuid('environment_id').notNullable();
    table.string('key', 255).notNullable();
    // Null for secrets: their value lives in the secret provider
    table.text('value');
    table.boolean('is_secret').notNullable().defaultTo(false);
    table.string('secret_ref', 512);
    timestamps(table);
    // Guarantees the environment belongs to the same project
    table
      .foreign(['project_id', 'environment_id'])
      .references(['project_id', 'id'])
      .inTable('environments')
      .onDelete('CASCADE');
    table.unique(['project_id', 'environment_id', 'key']);
    table.index(['project_id', 'environment_id'], 'configurations_project_env_idx');
  });

  // Storage for the built-in encrypted secret provider
  await knex.schema.createTable('secrets', table => {
    table.string('reference', 512).primary();
    table.text('ciphertext').notNullable();
    timestamps(table);
  });

  // No foreign keys: audit entries must outlive the rows they describe
  await knex.schema.createTable('audit_logs', table => {
    table.uuid('id').primary();
    table.uuid('tenant_id');
    table.uuid('user_id');
    table.string('action', 64).notNullable();
    table.string('resource_type', 64).notNullable();
    table.string('resource_id', 255);
    table.text('metadata');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['tenant_id', 'created_at'], 'audit_logs_tenant_created_idx');
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTable('audit_logs');
  await knex.schema.dropTable('secrets');
  await knex.schema.dropTable('configurations');
  await knex.schema.dropTable('environments');
  await knex.schema.dropTable('projects');
  await knex.schema.dropTable('user_tenants');
  await knex.schema.dropTable('user_credentials');
  await knex.schema.dropTable('users');
  await knex.schema.dropTable('tenants');
};
