// @ts-check

/**
 * When each user last signed in. Lets platform admins tell an assigned admin
 * who has never signed in ("invite pending") from an active one.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('users', table => {
    table.timestamp('last_sign_in_at', { useTz: true });
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.alterTable('users', table => {
    table.dropColumn('last_sign_in_at');
  });
};
