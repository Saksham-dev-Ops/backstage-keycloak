import {
  mockCredentials,
  mockServices,
  startTestBackend,
  TestDatabases,
} from '@backstage/backend-test-utils';
import tenantPlugin from '@internal/plugin-tenant-backend';
import request from 'supertest';
import { tenantModuleDepartmentQuota } from './modules/quotaModule';
import { departmentPlugin } from './plugin';

jest.setTimeout(60_000);

const databases = TestDatabases.create({ ids: ['POSTGRES_17', 'SQLITE_3'] });

const tenantSeed = {
  users: [
    { email: 'platform@example.com' },
    { email: 'admin-a@example.com' },
    { email: 'dev-a@example.com' },
    { email: 'viewer-a@example.com' },
    { email: 'admin-b@example.com' },
  ],
  tenants: [
    {
      slug: 'dept-a',
      name: 'Department A',
      members: [
        { email: 'admin-a@example.com', role: 'OWNER' },
        { email: 'dev-a@example.com', role: 'DEVELOPER' },
        { email: 'viewer-a@example.com', role: 'VIEWER' },
      ],
      projects: [
        {
          slug: 'assigned',
          name: 'Assigned Project',
          members: ['dev-a@example.com'],
        },
        { slug: 'secret', name: 'Unassigned Project' },
      ],
    },
    {
      slug: 'dept-b',
      name: 'Department B',
      members: [{ email: 'admin-b@example.com', role: 'OWNER' }],
      projects: [{ slug: 'billing', name: 'Billing' }],
    },
  ],
};

describe.each(databases.eachSupportedId())(
  'department plugin on %s',
  databaseId => {
    let server: Parameters<typeof request>[0];
    const userRefs = new Map<string, string>();
    const userIds = new Map<string, string>();
    const departmentIds = new Map<string, string>();
    let ministryA: string;
    let ministryB: string;
    let firstRequestStatuses: number[] = [];

    /** A valid onboarding form submission */
    const departmentBody = (overrides: Record<string, unknown> = {}) => ({
      ministryId: ministryA,
      name: 'Department of Electronics',
      shortCode: 'DOE',
      capabilities: ['project-management', 'documentation'],
      userLimit: 500,
      projectLimit: 50,
      adminsCanApproveJoinRequests: true,
      adminsCanCreateCustomRoles: false,
      admins: [
        {
          name: 'Priya Sharma',
          email: 'Priya@Example.com',
          designation: 'Director',
          mobile: '+91 9876543210',
        },
      ],
      ...overrides,
    });

    const as = (email: string) => ({
      Authorization: mockCredentials.user.header(userRefs.get(email)),
    });

    /** Signs a user in the way the auth module does, which records the sign-in */
    const signIn = async (email: string) => {
      const res = await request(server)
        .post('/api/tenant/internal/resolve-user')
        .set('Authorization', mockCredentials.service.header())
        .send({ email, provider: 'test' });
      if (res.status === 200) {
        userRefs.set(email, res.body.userEntityRef);
        userIds.set(email, res.body.userId);
      }
      return res;
    };

    beforeAll(async () => {
      const knex = await databases.init(databaseId);
      const backend = await startTestBackend({
        features: [
          tenantPlugin,
          departmentPlugin,
          tenantModuleDepartmentQuota,
          mockServices.database.factory({ knex }),
          mockServices.rootConfig.factory({
            data: {
              backend: { baseUrl: 'http://localhost:7007' },
              tenant: {
                platformAdmins: ['platform@example.com'],
                localAuth: {
                  enabled: true,
                  sessionSecret: 'test-session-secret',
                },
                secrets: { encryptionKey: 'test-encryption-key' },
                seed: tenantSeed,
              },
              department: {
                seed: {
                  ministries: [
                    {
                      name: 'Ministry of Testing',
                      departments: [
                        {
                          tenantSlug: 'dept-a',
                          userLimit: 10,
                          projectLimit: 10,
                        },
                      ],
                    },
                    { name: 'Ministry of Quality' },
                  ],
                },
              },
            },
          }),
        ],
      });
      server = backend.server;

      for (const { email } of tenantSeed.users) {
        await signIn(email);
      }
      // Like the departments page: stats and list load in parallel
      firstRequestStatuses = (
        await Promise.all(
          Array.from({ length: 5 }, (_, i) =>
            request(server)
              .get(
                i % 2 ? '/api/department/stats' : '/api/department/departments',
              )
              .set(as('platform@example.com')),
          ),
        )
      ).map(r => r.status);
      const ministries = await request(server)
        .get('/api/department/ministries')
        .set(as('platform@example.com'));
      ministryA = ministries.body.items.find(
        (m: { name: string }) => m.name === 'Ministry of Testing',
      ).id;
      ministryB = ministries.body.items.find(
        (m: { name: string }) => m.name === 'Ministry of Quality',
      ).id;

      const list = await request(server)
        .get('/api/department/departments?pageSize=100')
        .set(as('platform@example.com'));
      for (const d of list.body.items) {
        departmentIds.set(d.slug, d.id);
      }
    });

    describe('authentication', () => {
      it('rejects unauthenticated requests with a typed error', async () => {
        const res = await request(server).get('/api/department/departments');
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
      });

      it('does not let users read the internal limits', async () => {
        const res = await request(server)
          .get(
            `/api/department/internal/departments/${departmentIds.get(
              'dept-a',
            )}/limits`,
          )
          .set(as('admin-a@example.com'));
        expect(res.status).toBe(403);
      });
    });

    describe('departments (platform admin)', () => {
      it('handles concurrent first requests that apply the seed', () => {
        // Sent in parallel in beforeAll, before anything else touched the seed
        expect(firstRequestStatuses).toEqual([200, 200, 200, 200, 200]);
      });

      it('lists every department with its ministry, admins, usage and status', async () => {
        const res = await request(server)
          .get('/api/department/departments')
          .set(as('platform@example.com'));
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(2);
        const a = res.body.items.find(
          (d: { slug: string }) => d.slug === 'dept-a',
        );
        expect(a).toMatchObject({
          name: 'Department A',
          ministry: { name: 'Ministry of Testing' },
          userCount: 3,
          projectCount: 2,
          userLimit: 10,
          projectLimit: 10,
          status: 'active',
          callerRole: 'PLATFORM_ADMIN',
        });
        expect(a.admins).toEqual([
          expect.objectContaining({
            email: 'admin-a@example.com',
            role: 'OWNER',
            hasSignedIn: true,
          }),
        ]);
        const b = res.body.items.find(
          (d: { slug: string }) => d.slug === 'dept-b',
        );
        expect(b.ministry).toBeUndefined();
      });

      it('creates, reads, updates and deletes a department', async () => {
        const created = await request(server)
          .post('/api/department/departments')
          .set(as('platform@example.com'))
          .send(
            departmentBody({
              admins: [
                {
                  name: 'Priya Sharma',
                  email: 'Priya@Example.com',
                  designation: 'Director',
                  mobile: '+91 9876543210',
                },
                {
                  name: 'Rohan Kumar',
                  email: 'rohan@example.com',
                  designation: 'Designer',
                  mobile: '+919876500000',
                },
              ],
            }),
          );
        expect(created.status).toBe(201);
        expect(created.headers['cache-control']).toBe('no-store');
        expect(created.body.department).toMatchObject({
          name: 'Department of Electronics',
          slug: 'doe',
          shortCode: 'DOE',
          ministry: { id: ministryA },
          userCount: 2,
          userLimit: 500,
          capabilities: ['documentation', 'project-management'],
          adminsCanApproveJoinRequests: true,
          adminsCanCreateCustomRoles: false,
          // The new admins have never signed in
          status: 'invite_pending',
        });
        expect(created.body.department.admins).toEqual([
          expect.objectContaining({
            email: 'priya@example.com',
            role: 'OWNER',
            designation: 'Director',
          }),
          expect.objectContaining({
            email: 'rohan@example.com',
            role: 'OWNER',
            mobile: '+919876500000',
          }),
        ]);
        // Both admins are new accounts, so both get a one-time invite link
        expect(
          created.body.invites.map((i: { email: string }) => i.email),
        ).toEqual(['priya@example.com', 'rohan@example.com']);
        const lookup = await request(server)
          .post('/api/tenant/session/invite/lookup')
          .send({ token: created.body.invites[0].token });
        expect(lookup.body.email).toBe('priya@example.com');
        const id = created.body.department.id;

        const fetched = await request(server)
          .get(`/api/department/departments/${id}`)
          .set(as('platform@example.com'));
        expect(fetched.status).toBe(200);
        expect(fetched.body.name).toBe('Department of Electronics');

        // Becomes active once the admin signs in
        await signIn('priya@example.com');
        const afterSignIn = await request(server)
          .get(`/api/department/departments/${id}`)
          .set(as('platform@example.com'));
        expect(afterSignIn.body.status).toBe('active');

        const updated = await request(server)
          .put(`/api/department/departments/${id}`)
          .set(as('platform@example.com'))
          .send({
            name: 'Department of Electronics and IT',
            ministryId: ministryB,
            projectLimit: 20,
          });
        expect(updated.status).toBe(200);
        expect(updated.body).toMatchObject({
          name: 'Department of Electronics and IT',
          ministry: { id: ministryB },
          projectLimit: 20,
        });

        const suspended = await request(server)
          .put(`/api/department/departments/${id}`)
          .set(as('platform@example.com'))
          .send({ status: 'suspended' });
        expect(suspended.body.status).toBe('suspended');

        const deleted = await request(server)
          .delete(`/api/department/departments/${id}`)
          .set(as('platform@example.com'));
        expect(deleted.status).toBe(204);
        const gone = await request(server)
          .get(`/api/department/departments/${id}`)
          .set(as('platform@example.com'));
        expect(gone.status).toBe(404);
        expect(gone.body.error.code).toBe('DEPARTMENT_NOT_FOUND');
      });

      it('validates input', async () => {
        const cases: Array<[string, Record<string, unknown>]> = [
          [
            'bad email',
            {
              admins: [
                {
                  name: 'Val',
                  email: 'nope',
                  designation: 'Lead',
                  mobile: '+91 9876543210',
                },
              ],
            },
          ],
          [
            'bad mobile',
            {
              admins: [
                {
                  name: 'Val',
                  email: 'v@example.com',
                  designation: 'Lead',
                  mobile: '12345',
                },
              ],
            },
          ],
          [
            'missing designation',
            {
              admins: [
                {
                  name: 'Val',
                  email: 'v@example.com',
                  mobile: '+91 9876543210',
                },
              ],
            },
          ],
          ['no admins', { admins: [] }],
          [
            'duplicate admins',
            {
              admins: [
                {
                  name: 'Val',
                  email: 'v@example.com',
                  designation: 'Lead',
                  mobile: '+91 9876543210',
                },
                {
                  name: 'Val 2',
                  email: 'V@example.com',
                  designation: 'Lead',
                  mobile: '+91 9876543211',
                },
              ],
            },
          ],
          ['no capabilities', { capabilities: [] }],
          ['unknown capability', { capabilities: ['crypto-mining'] }],
          ['bad short code', { shortCode: 'DI GI' }],
          ['zero limit', { userLimit: 0 }],
          [
            'more admins than users',
            {
              userLimit: 1,
              admins: [
                {
                  name: 'Val',
                  email: 'v@example.com',
                  designation: 'Lead',
                  mobile: '+91 9876543210',
                },
                {
                  name: 'Val 2',
                  email: 'w@example.com',
                  designation: 'Lead',
                  mobile: '+91 9876543211',
                },
              ],
            },
          ],
        ];
        for (const [label, overrides] of cases) {
          const res = await request(server)
            .post('/api/department/departments')
            .set(as('platform@example.com'))
            .send(departmentBody({ shortCode: 'VAL', ...overrides }));
          expect([label, res.status, res.body.error?.code]).toEqual([
            label,
            400,
            'VALIDATION_FAILED',
          ]);
        }

        const unknownMinistry = await request(server)
          .post('/api/department/departments')
          .set(as('platform@example.com'))
          .send(
            departmentBody({
              shortCode: 'VAL',
              ministryId: '00000000-0000-4000-8000-000000000000',
            }),
          );
        expect(unknownMinistry.status).toBe(400);
        expect(unknownMinistry.body.error.code).toBe('MINISTRY_NOT_FOUND');

        const badId = await request(server)
          .get('/api/department/departments/1%20OR%201=1')
          .set(as('platform@example.com'));
        expect(badId.status).toBe(400);
      });

      it('rejects a short code that is already taken, ignoring case', async () => {
        const res = await request(server)
          .post('/api/department/departments')
          .set(as('platform@example.com'))
          .send(departmentBody({ shortCode: 'Dept-A' }));
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('SHORT_CODE_TAKEN');
      });

      it('checks short code availability', async () => {
        const taken = await request(server)
          .get('/api/department/short-codes/DEPT-A')
          .set(as('platform@example.com'));
        expect(taken.body).toEqual({ shortCode: 'DEPT-A', available: false });
        const free = await request(server)
          .get('/api/department/short-codes/digi')
          .set(as('platform@example.com'));
        expect(free.body).toEqual({ shortCode: 'DIGI', available: true });
        const denied = await request(server)
          .get('/api/department/short-codes/digi')
          .set(as('admin-a@example.com'));
        expect(denied.status).toBe(403);
      });

      it('serves the capability catalog to platform admins only', async () => {
        const res = await request(server)
          .get('/api/department/capabilities')
          .set(as('platform@example.com'));
        expect(res.body.items.map((c: { id: string }) => c.id)).toContain(
          'code-and-pipelines',
        );
        const denied = await request(server)
          .get('/api/department/capabilities')
          .set(as('admin-a@example.com'));
        expect(denied.status).toBe(403);
      });

      it('creates no invite for admins who already have an account', async () => {
        const res = await request(server)
          .post('/api/department/departments')
          .set(as('platform@example.com'))
          .send(
            departmentBody({
              shortCode: 'EXISTING',
              admins: [
                {
                  name: 'Admin B',
                  email: 'admin-b@example.com',
                  designation: 'Lead',
                  mobile: '+91 9876543210',
                },
              ],
            }),
          );
        expect(res.status).toBe(201);
        expect(res.body.invites).toEqual([]);
        await request(server)
          .delete(`/api/department/departments/${res.body.department.id}`)
          .set(as('platform@example.com'));
      });

      it('lets platform admins regenerate invite links for pending users only', async () => {
        const { body } = await request(server)
          .post('/api/department/departments')
          .set(as('platform@example.com'))
          .send(
            departmentBody({
              shortCode: 'INVITES',
              admins: [
                {
                  name: 'Pending',
                  email: 'pending@example.com',
                  designation: 'Lead',
                  mobile: '+91 9876543210',
                },
                {
                  name: 'Admin B',
                  email: 'admin-b@example.com',
                  designation: 'Lead',
                  mobile: '+91 9876543210',
                },
              ],
            }),
          );
        const id = body.department.id;
        const users = await request(server)
          .get(`/api/department/departments/${id}/users`)
          .set(as('platform@example.com'));
        const pending = users.body.items.find(
          (u: { email: string }) => u.email === 'pending@example.com',
        );
        expect(pending).toMatchObject({
          hasPassword: false,
          designation: 'Lead',
        });

        const invite = await request(server)
          .post(
            `/api/department/departments/${id}/users/${pending.userId}/invite`,
          )
          .set(as('platform@example.com'));
        expect(invite.status).toBe(201);
        expect(invite.body.token).toBeDefined();

        // A user of another department cannot be targeted through this one
        const foreign = await request(server)
          .post(
            `/api/department/departments/${id}/users/${userIds.get(
              'dev-a@example.com',
            )}/invite`,
          )
          .set(as('platform@example.com'));
        expect(foreign.status).toBe(404);

        await request(server)
          .delete(`/api/department/departments/${id}`)
          .set(as('platform@example.com'));
      });

      it('does not show admin mobiles to organization admins', async () => {
        const res = await request(server)
          .get(`/api/department/departments/${departmentIds.get('dept-a')}`)
          .set(as('admin-a@example.com'));
        expect(res.status).toBe(200);
        expect(JSON.stringify(res.body)).not.toContain('mobile');
      });

      it('does not lower a limit below the current usage', async () => {
        const res = await request(server)
          .put(`/api/department/departments/${departmentIds.get('dept-a')}`)
          .set(as('platform@example.com'))
          .send({ userLimit: 1 });
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('LIMIT_BELOW_USAGE');
      });

      it('filters and paginates', async () => {
        const byMinistry = await request(server)
          .get(`/api/department/departments?ministryId=${ministryA}`)
          .set(as('platform@example.com'));
        expect(
          byMinistry.body.items.map((d: { slug: string }) => d.slug),
        ).toEqual(['dept-a']);

        const unassigned = await request(server)
          .get('/api/department/departments?ministryId=unassigned')
          .set(as('platform@example.com'));
        expect(
          unassigned.body.items.map((d: { slug: string }) => d.slug),
        ).toEqual(['dept-b']);

        const search = await request(server)
          .get('/api/department/departments?search=ment%20b')
          .set(as('platform@example.com'));
        expect(search.body.total).toBe(1);

        const page2 = await request(server)
          .get('/api/department/departments?page=2&pageSize=1')
          .set(as('platform@example.com'));
        expect(page2.body).toMatchObject({ total: 2, page: 2, pageSize: 1 });
        expect(page2.body.items).toHaveLength(1);
      });

      it('returns the stats of all departments', async () => {
        const res = await request(server)
          .get('/api/department/stats')
          .set(as('platform@example.com'));
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(2);
        expect(
          res.body.active +
            res.body.invitePending +
            res.body.noAdmin +
            res.body.suspended,
        ).toBe(2);
      });
    });

    describe('tenant isolation', () => {
      it('only lists the departments the caller belongs to', async () => {
        const res = await request(server)
          .get('/api/department/departments')
          .set(as('admin-a@example.com'));
        expect(res.status).toBe(200);
        expect(res.body.items.map((d: { slug: string }) => d.slug)).toEqual([
          'dept-a',
        ]);
        expect(res.body.items[0].callerRole).toBe('ORGANIZATION_ADMIN');
      });

      it('ignores a forged x-tenant-id header', async () => {
        const res = await request(server)
          .get('/api/department/departments')
          .set({
            ...as('admin-a@example.com'),
            'x-tenant-id': departmentIds.get('dept-b')!,
          });
        expect(res.body.items.map((d: { slug: string }) => d.slug)).toEqual([
          'dept-a',
        ]);
      });

      it('returns 404 for another tenant department, its users and its projects', async () => {
        const b = departmentIds.get('dept-b');
        for (const path of [
          `/departments/${b}`,
          `/departments/${b}/users`,
          `/departments/${b}/projects`,
        ]) {
          const res = await request(server)
            .get(`/api/department${path}`)
            .set(as('admin-a@example.com'));
          expect(res.status).toBe(404);
          expect(JSON.stringify(res.body)).not.toContain('Billing');
        }
      });

      it('cannot add or remove users in another tenant department', async () => {
        const b = departmentIds.get('dept-b');
        const add = await request(server)
          .post(`/api/department/departments/${b}/users`)
          .set(as('admin-a@example.com'))
          .send({ email: 'intruder@example.com', role: 'ADMIN' });
        expect(add.status).toBe(404);
        const remove = await request(server)
          .delete(
            `/api/department/departments/${b}/users/${userIds.get(
              'admin-b@example.com',
            )}`,
          )
          .set(as('admin-a@example.com'));
        expect(remove.status).toBe(404);
      });
    });

    describe('authorization', () => {
      it('lets platform admins access any department', async () => {
        const res = await request(server)
          .get(
            `/api/department/departments/${departmentIds.get('dept-b')}/users`,
          )
          .set(as('platform@example.com'));
        expect(res.status).toBe(200);
        expect(res.body.items.map((u: { email: string }) => u.email)).toEqual([
          'admin-b@example.com',
        ]);
      });

      it('lets organization admins manage users of their own department', async () => {
        const a = departmentIds.get('dept-a');
        const added = await request(server)
          .post(`/api/department/departments/${a}/users`)
          .set(as('admin-a@example.com'))
          .send({
            email: 'new-a@example.com',
            name: 'New A',
            role: 'DEVELOPER',
          });
        expect(added.status).toBe(201);
        const removed = await request(server)
          .delete(`/api/department/departments/${a}/users/${added.body.userId}`)
          .set(as('admin-a@example.com'));
        expect(removed.status).toBe(204);
      });

      it('does not let organization admins change platform data', async () => {
        const a = departmentIds.get('dept-a');
        const update = await request(server)
          .put(`/api/department/departments/${a}`)
          .set(as('admin-a@example.com'))
          .send({ userLimit: 1000 });
        expect(update.status).toBe(403);
        const create = await request(server)
          .post('/api/department/ministries')
          .set(as('admin-a@example.com'))
          .send({ name: 'Rogue ministry' });
        expect(create.status).toBe(403);
        const audit = await request(server)
          .get('/api/department/audit')
          .set(as('admin-a@example.com'));
        expect(audit.status).toBe(403);
      });

      it('does not let users see the users of their department', async () => {
        const res = await request(server)
          .get(
            `/api/department/departments/${departmentIds.get('dept-a')}/users`,
          )
          .set(as('dev-a@example.com'));
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      it('only shows users the projects assigned to them', async () => {
        const a = departmentIds.get('dept-a');
        const dev = await request(server)
          .get(`/api/department/departments/${a}/projects`)
          .set(as('dev-a@example.com'));
        expect(dev.body.items.map((p: { slug: string }) => p.slug)).toEqual([
          'assigned',
        ]);

        const viewer = await request(server)
          .get(`/api/department/departments/${a}/projects`)
          .set(as('viewer-a@example.com'));
        expect(viewer.body.items).toEqual([]);

        const admin = await request(server)
          .get(`/api/department/departments/${a}/projects`)
          .set(as('admin-a@example.com'));
        expect(admin.body.items).toHaveLength(2);
      });

      it('does not let organization admins escalate to a role above their own', async () => {
        // An ADMIN (not OWNER) of dept-a
        const a = departmentIds.get('dept-a');
        await request(server)
          .post(`/api/department/departments/${a}/users`)
          .set(as('platform@example.com'))
          .send({
            email: 'second-admin@example.com',
            name: 'Second',
            role: 'ADMIN',
          });
        await signIn('second-admin@example.com');
        const res = await request(server)
          .post(`/api/department/departments/${a}/users`)
          .set(as('second-admin@example.com'))
          .send({ email: 'new-owner@example.com', role: 'OWNER' });
        expect(res.status).toBe(403);
        await request(server)
          .delete(
            `/api/department/departments/${a}/users/${userIds.get(
              'second-admin@example.com',
            )}`,
          )
          .set(as('platform@example.com'));
      });
    });

    describe('limits', () => {
      it('enforces the user and project limits in the tenant plugin', async () => {
        const {
          body: { department },
        } = await request(server)
          .post('/api/department/departments')
          .set(as('platform@example.com'))
          .send(
            departmentBody({
              name: 'Department of Limits',
              shortCode: 'LIMITS',
              admins: [
                {
                  name: 'Lim',
                  email: 'lim@example.com',
                  designation: 'Lead',
                  mobile: '+91 9876543210',
                },
              ],
              userLimit: 2,
              projectLimit: 1,
            }),
          );
        await signIn('lim@example.com');

        const second = await request(server)
          .post(`/api/department/departments/${department.id}/users`)
          .set(as('lim@example.com'))
          .send({ email: 'lim2@example.com', role: 'VIEWER' });
        expect(second.status).toBe(201);
        const third = await request(server)
          .post(`/api/department/departments/${department.id}/users`)
          .set(as('lim@example.com'))
          .send({ email: 'lim3@example.com', role: 'VIEWER' });
        expect(third.status).toBe(409);
        expect(third.body.error.message).toContain('limit');

        // Projects are created in the organization UI, through the tenant plugin
        const project = (slug: string) =>
          request(server)
            .post('/api/tenant/projects')
            .set({ ...as('lim@example.com'), 'x-tenant-id': department.id })
            .send({ name: slug, slug });
        expect((await project('first')).status).toBe(201);
        expect((await project('second')).status).toBe(409);
      });
    });

    describe('ministries', () => {
      it('creates, renames and deletes ministries, but not ones with departments', async () => {
        const created = await request(server)
          .post('/api/department/ministries')
          .set(as('platform@example.com'))
          .send({ name: 'Ministry of Defence' });
        expect(created.status).toBe(201);
        expect(created.body.slug).toBe('ministry-of-defence');

        const duplicate = await request(server)
          .post('/api/department/ministries')
          .set(as('platform@example.com'))
          .send({ name: 'Ministry of Defence' });
        expect(duplicate.status).toBe(409);

        const renamed = await request(server)
          .put(`/api/department/ministries/${created.body.id}`)
          .set(as('platform@example.com'))
          .send({ name: 'Ministry of Defence Affairs' });
        expect(renamed.body.name).toBe('Ministry of Defence Affairs');

        const inUse = await request(server)
          .delete(`/api/department/ministries/${ministryA}`)
          .set(as('platform@example.com'));
        expect(inUse.status).toBe(409);
        expect(inUse.body.error.code).toBe('MINISTRY_HAS_DEPARTMENTS');

        const deleted = await request(server)
          .delete(`/api/department/ministries/${created.body.id}`)
          .set(as('platform@example.com'));
        expect(deleted.status).toBe(204);
      });
    });

    describe('audit log', () => {
      it('records changes without secrets', async () => {
        const res = await request(server)
          .get('/api/department/audit')
          .set(as('platform@example.com'));
        expect(res.status).toBe(200);
        const actions = res.body.items.map((e: { action: string }) => e.action);
        expect(actions).toEqual(
          expect.arrayContaining([
            'DEPARTMENT_CREATED',
            'DEPARTMENT_DELETED',
            'MINISTRY_CREATED',
          ]),
        );
        expect(JSON.stringify(res.body)).not.toMatch(/password/i);
      });
    });
  },
);
