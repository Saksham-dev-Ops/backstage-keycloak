// @ts-check

/**
 * Per-tenant plugin switches. A missing row means the plugin is enabled, so
 * existing tenants keep every plugin until an admin turns one off.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('tenant_plugins', table => {
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('plugin_id', 64).notNullable();
    table.boolean('enabled').notNullable();
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.primary(['tenant_id', 'plugin_id']);
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTable('tenant_plugins');
};
