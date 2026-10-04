// @ts-check

/**
 * One-time invites that let a new user set their own password. Only a
 * SHA-256 hash of the token is stored, so a database leak does not expose
 * usable invite links.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('user_invites', table => {
    table.uuid('id').primary();
    table
      .uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.string('token_hash', 64).notNullable().unique();
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.uuid('created_by');
    table
      .timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.timestamp('accepted_at', { useTz: true });
    table.index(['user_id'], 'user_invites_user_id_idx');
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTable('user_invites');
};
