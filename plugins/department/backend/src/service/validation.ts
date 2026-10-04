import { z } from 'zod';
import { CAPABILITY_IDS } from '../models/capabilities';
import { DEPARTMENT_STATUSES, TENANT_ROLES } from '../types';
import { badRequest } from './errors';

export const idSchema = z.uuid();
const nameSchema = z.string().trim().min(2).max(255);
const emailSchema = z
  .email()
  .max(320)
  .transform(email => email.toLowerCase());
const passwordSchema = z.string().min(12).max(1024);
const limitSchema = z.number().int().min(1).max(1_000_000);
/** Becomes the tenant slug (lower-cased): unique and immutable */
export const shortCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(20)
  .regex(
    /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/,
    'must contain letters, digits and single dashes',
  );
const mobileSchema = z
  .string()
  .trim()
  .regex(
    /^\+\d{1,3} ?\d{6,14}$/,
    'must be a country code and number, e.g. +91 9876543210',
  );

export const schemas = {
  listDepartments: z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
    /** A ministry id, or `unassigned` */
    ministryId: z.union([idSchema, z.literal('unassigned')]).optional(),
    status: z.enum(DEPARTMENT_STATUSES).optional(),
    /** Matches department names */
    search: z.string().trim().max(255).optional(),
    /** Matches admin names and emails */
    admin: z.string().trim().max(320).optional(),
  }),
  createDepartment: z
    .object({
      ministryId: idSchema,
      name: nameSchema,
      shortCode: shortCodeSchema,
      capabilities: z
        .array(z.enum(CAPABILITY_IDS))
        .min(1, 'select at least one area'),
      userLimit: limitSchema,
      projectLimit: limitSchema,
      adminsCanApproveJoinRequests: z.boolean().default(false),
      adminsCanCreateCustomRoles: z.boolean().default(false),
      admins: z
        .array(
          z.object({
            name: nameSchema,
            email: emailSchema,
            designation: z.string().trim().min(2).max(255),
            mobile: mobileSchema,
          }),
        )
        .min(1, 'add at least one department admin')
        .max(20),
    })
    .refine(b => new Set(b.admins.map(a => a.email)).size === b.admins.length, {
      message: 'each admin email can only be added once',
      path: ['admins'],
    })
    .refine(b => b.admins.length <= b.userLimit, {
      message: 'the user limit must allow at least every admin',
      path: ['userLimit'],
    }),
  updateDepartment: z
    .object({
      name: nameSchema.optional(),
      ministryId: idSchema.optional(),
      userLimit: limitSchema.nullable().optional(),
      projectLimit: limitSchema.nullable().optional(),
      status: z.enum(['active', 'suspended']).optional(),
    })
    .refine(body => Object.keys(body).length > 0, 'Nothing to update'),
  addUser: z.object({
    name: nameSchema.optional(),
    email: emailSchema,
    role: z.enum(TENANT_ROLES),
    /** Without one, a new user gets an invite link */
    password: passwordSchema.optional(),
  }),
  updateUser: z.object({ role: z.enum(TENANT_ROLES) }),
  createMinistry: z.object({
    name: nameSchema,
    description: z.string().trim().max(2000).optional(),
  }),
  updateMinistry: z
    .object({
      name: nameSchema.optional(),
      description: z.string().trim().max(2000).optional(),
    })
    .refine(body => Object.keys(body).length > 0, 'Nothing to update'),
  auditQuery: z.object({
    limit: z.coerce.number().int().min(1).max(500).default(100),
    departmentId: idSchema.optional(),
  }),
};

/**
 * Parses untrusted input. Error messages name the offending field but never
 * echo submitted values, which may be passwords.
 */
export function parse<T extends z.ZodType>(
  schema: T,
  input: unknown,
): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') || 'request';
    throw badRequest(
      'VALIDATION_FAILED',
      `Invalid ${path}: ${issue?.message ?? 'invalid value'}`,
    );
  }
  return result.data;
}

export function parseId(value: unknown, name: string): string {
  if (!idSchema.safeParse(value).success) {
    throw badRequest('INVALID_ID', `Invalid ${name}`);
  }
  return value as string;
}
