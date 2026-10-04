import { InputError } from '@backstage/errors';
import { z } from 'zod';
import { TENANT_PLUGIN_IDS } from './tenantPlugins';
import { ROLES } from './types';

export const idSchema = z.uuid();
export const slugSchema = z
  .string()
  .min(1)
  .max(63)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'must contain lowercase letters, digits and single dashes',
  );
export const emailSchema = z
  .email()
  .max(320)
  .transform(email => email.toLowerCase());
export const roleSchema = z.enum(ROLES);
const nameSchema = z.string().trim().min(1).max(255);
const environmentNameSchema = z
  .string()
  .min(1)
  .max(63)
  .regex(
    /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/,
    'must contain lowercase letters, digits, dashes or underscores',
  );
const configKeySchema = z
  .string()
  .min(1)
  .max(255)
  .regex(
    /^[A-Za-z_][A-Za-z0-9_.-]*$/,
    'must start with a letter or underscore and contain only letters, digits, _ . -',
  );
const configValueSchema = z.string().max(65536);
const passwordSchema = z.string().min(12).max(1024);

export const schemas = {
  login: z.object({ email: emailSchema, password: z.string().max(1024) }),
  resolveUser: z.union([
    z.object({ email: emailSchema, provider: z.string().max(64) }),
    z.object({ userId: idSchema, provider: z.string().max(64) }),
  ]),
  switchTenant: z.object({ tenantId: idSchema }),
  createTenant: z.object({
    name: nameSchema,
    slug: slugSchema,
    /** Defaults to the platform admin creating the tenant */
    ownerEmail: emailSchema.optional(),
    ownerName: nameSchema.optional(),
    /** Without it, a new owner gets an invite link to set their password */
    ownerPassword: passwordSchema.optional(),
    /** More owners, created in the same transaction; new users get invites */
    additionalOwners: z
      .array(z.object({ email: emailSchema, name: nameSchema.optional() }))
      .max(19)
      .optional(),
  }),
  inviteToken: z.object({ token: z.string().min(20).max(128) }),
  acceptInvite: z.object({ token: z.string().min(20).max(128), password: passwordSchema }),
  updateTenant: z.object({ name: nameSchema }),
  addMember: z.object({
    email: emailSchema,
    name: nameSchema.optional(),
    role: roleSchema,
    /** Only applied when this creates a brand-new user with local sign-in */
    password: passwordSchema.optional(),
  }),
  updateMember: z.object({ role: roleSchema }),
  adminUpdateTenant: z
    .object({
      name: nameSchema.optional(),
      status: z.enum(['active', 'suspended']).optional(),
    })
    .refine(body => Object.keys(body).length > 0, 'Nothing to update'),
  adminProjectsQuery: z.object({ tenantId: idSchema.optional() }),
  createProject: z.object({
    name: nameSchema,
    slug: slugSchema,
    description: z.string().max(2000).optional(),
    environments: z
      .array(environmentNameSchema)
      .max(20)
      .default(['development', 'staging', 'production']),
  }),
  updateProject: z
    .object({
      name: nameSchema.optional(),
      description: z.string().max(2000).optional(),
    })
    .refine(body => Object.keys(body).length > 0, 'Nothing to update'),
  createEnvironment: z.object({ name: environmentNameSchema }),
  listConfig: z.object({ environmentId: idSchema.optional() }),
  createConfig: z.object({
    environmentId: idSchema,
    key: configKeySchema,
    value: configValueSchema,
    isSecret: z.boolean().default(false),
  }),
  updateConfig: z
    .object({ key: configKeySchema.optional(), value: configValueSchema.optional() })
    .refine(body => Object.keys(body).length > 0, 'Nothing to update'),
  pluginId: z.enum(TENANT_PLUGIN_IDS),
  setPlugin: z.object({ enabled: z.boolean() }),
  pluginAccess: z.object({ path: z.string().max(2048) }),
  auditQuery: z.object({
    limit: z.coerce.number().int().min(1).max(500).default(100),
  }),
};

/**
 * Parses untrusted input. Error messages describe the offending field but
 * never echo submitted values, which may be secrets.
 */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') || 'request';
    throw new InputError(`Invalid ${path}: ${issue?.message ?? 'invalid value'}`);
  }
  return result.data;
}

export function parseId(value: unknown, name: string): string {
  if (!idSchema.safeParse(value).success) {
    throw new InputError(`Invalid ${name}`);
  }
  return value as string;
}
