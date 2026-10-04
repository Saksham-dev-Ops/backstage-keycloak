import {
  mockCredentials,
  mockServices,
  startTestBackend,
  TestDatabases,
} from '@backstage/backend-test-utils';
import request from 'supertest';
import { tenantPlugin } from './plugin';

jest.setTimeout(60_000);

const databases = TestDatabases.create({ ids: ['POSTGRES_17', 'SQLITE_3'] });

const PASSWORD = 'correct-horse-battery';

const seed = {
  users: [
    { email: 'owner-a@example.com', password: PASSWORD },
    { email: 'admin-a@example.com' },
    { email: 'dev-a@example.com' },
    { email: 'viewer-a@example.com' },
    { email: 'owner-b@example.com' },
    { email: 'multi@example.com' },
    { email: 'nobody@example.com' },
  ],
  tenants: [
    {
      slug: 'tenant-a',
      name: 'Tenant A',
      members: [
        { email: 'owner-a@example.com', role: 'OWNER' },
        { email: 'admin-a@example.com', role: 'ADMIN' },
        { email: 'dev-a@example.com', role: 'DEVELOPER' },
        { email: 'viewer-a@example.com', role: 'VIEWER' },
        { email: 'multi@example.com', role: 'ADMIN' },
      ],
      projects: [
        {
          slug: 'payments',
          name: 'Payment Service',
          members: ['dev-a@example.com', 'viewer-a@example.com'],
        },
        { slug: 'internal', name: 'Internal Tools' },
      ],
    },
    {
      slug: 'tenant-b',
      name: 'Tenant B',
      members: [
        { email: 'owner-b@example.com', role: 'OWNER' },
        { email: 'multi@example.com', role: 'VIEWER' },
      ],
      projects: [{ slug: 'billing', name: 'Billing' }],
    },
  ],
};

describe.each(databases.eachSupportedId())('tenant plugin on %s', databaseId => {
  let server: Parameters<typeof request>[0];
  let knex: Awaited<ReturnType<typeof databases.init>>;
  const userRefs = new Map<string, string>();
  const userIds = new Map<string, string>();
  const tenantIds = new Map<string, string>();
  const projectIds = new Map<string, string>();

  /** Headers for a user acting in a tenant, as the frontend would send them */
  const as = (email: string, tenant?: string) => ({
    Authorization: mockCredentials.user.header(userRefs.get(email)),
    ...(tenant ? { 'x-tenant-id': tenantIds.get(tenant)! } : {}),
  });

  beforeAll(async () => {
    knex = await databases.init(databaseId);
    const backend = await startTestBackend({
      features: [
        tenantPlugin,
        mockServices.database.factory({ knex }),
        mockServices.rootConfig.factory({
          data: {
            backend: { baseUrl: 'http://localhost:7007' },
            tenant: {
              platformAdmins: ['owner-a@example.com'],
              localAuth: { enabled: true, sessionSecret: 'test-session-secret' },
              secrets: { encryptionKey: 'test-encryption-key' },
              seed,
            },
          },
        }),
      ],
    });
    server = backend.server;

    // Resolve identities exactly like the auth module does at sign-in
    for (const { email } of seed.users) {
      const res = await request(server)
        .post('/api/tenant/internal/resolve-user')
        .set('Authorization', mockCredentials.service.header())
        .send({ email, provider: 'test' });
      if (res.status === 200) {
        userRefs.set(email, res.body.userEntityRef);
        userIds.set(email, res.body.userId);
      }
    }
    for (const owner of ['owner-a@example.com', 'owner-b@example.com']) {
      const me = await request(server).get('/api/tenant/me').set(as(owner));
      for (const tenant of me.body.tenants) {
        tenantIds.set(tenant.slug, tenant.id);
        const projects = await request(server)
          .get('/api/tenant/projects')
          .set(as(owner, tenant.slug));
        for (const project of projects.body.items) {
          projectIds.set(project.slug, project.id);
        }
      }
    }
  });

  describe('authentication', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await request(server).get('/api/tenant/projects');
      expect(res.status).toBe(401);
    });

    it('does not resolve users without any tenant membership', async () => {
      const res = await request(server)
        .post('/api/tenant/internal/resolve-user')
        .set('Authorization', mockCredentials.service.header())
        .send({ email: 'nobody@example.com', provider: 'test' });
      expect(res.status).toBe(404);
    });

    it('does not let users call the internal resolver', async () => {
      const res = await request(server)
        .post('/api/tenant/internal/resolve-user')
        .set(as('dev-a@example.com'))
        .send({ email: 'owner-a@example.com', provider: 'test' });
      expect(res.status).toBe(403);
    });

    it('sets a session cookie for valid local credentials only', async () => {
      const bad = await request(server)
        .post('/api/tenant/session/login')
        .send({ email: 'owner-a@example.com', password: 'wrong-password' });
      expect(bad.status).toBe(401);
      expect(bad.headers['set-cookie']).toBeUndefined();

      const good = await request(server)
        .post('/api/tenant/session/login')
        .send({ email: 'owner-a@example.com', password: PASSWORD });
      expect(good.status).toBe(204);
      expect(String(good.headers['set-cookie'])).toContain('HttpOnly');
    });

    it('lists only the tenants a user is a member of', async () => {
      const res = await request(server).get('/api/tenant/me').set(as('dev-a@example.com'));
      expect(res.status).toBe(200);
      expect(res.body.tenants.map((t: { slug: string }) => t.slug)).toEqual(['tenant-a']);
    });
  });

  describe('tenant isolation', () => {
    it('returns 404 for a tenant the user is not a member of, even with a forged header', async () => {
      const res = await request(server)
        .get('/api/tenant/projects')
        .set(as('owner-a@example.com', 'tenant-b'));
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain('Billing');
    });

    it('returns 404 when requesting another tenant project by id', async () => {
      const res = await request(server)
        .get(`/api/tenant/projects/${projectIds.get('billing')}`)
        .set(as('owner-a@example.com', 'tenant-a'));
      expect(res.status).toBe(404);
    });

    it('cannot modify or delete another tenant project by id', async () => {
      const id = projectIds.get('billing');
      const patch = await request(server)
        .patch(`/api/tenant/projects/${id}`)
        .set(as('owner-a@example.com', 'tenant-a'))
        .send({ name: 'hijacked' });
      const del = await request(server)
        .delete(`/api/tenant/projects/${id}`)
        .set(as('owner-a@example.com', 'tenant-a'));
      expect(patch.status).toBe(404);
      expect(del.status).toBe(404);

      const check = await request(server)
        .get(`/api/tenant/projects/${id}`)
        .set(as('owner-b@example.com', 'tenant-b'));
      expect(check.body.name).toBe('Billing');
    });

    it('rejects malformed ids and tenant headers', async () => {
      const badProject = await request(server)
        .get('/api/tenant/projects/1%20OR%201=1')
        .set(as('owner-a@example.com', 'tenant-a'));
      expect(badProject.status).toBe(400);

      const badTenant = await request(server)
        .get('/api/tenant/projects')
        .set(as('owner-a@example.com'))
        .set('x-tenant-id', 'tenant-b');
      expect(badTenant.status).toBe(400);
    });
  });

  describe('configuration and secret isolation', () => {
    let configId: string;
    let secretId: string;
    let environmentId: string;

    beforeAll(async () => {
      const project = await request(server)
        .get(`/api/tenant/projects/${projectIds.get('payments')}`)
        .set(as('admin-a@example.com', 'tenant-a'));
      environmentId = project.body.environments[0].id;

      const config = await request(server)
        .post(`/api/tenant/projects/${projectIds.get('payments')}/config`)
        .set(as('admin-a@example.com', 'tenant-a'))
        .send({ environmentId, key: 'API_URL', value: 'https://api.a.example' });
      if (config.status !== 201) {
        throw new Error(`Setup failed: ${config.status}`);
      }
      configId = config.body.id;

      const secret = await request(server)
        .post(`/api/tenant/projects/${projectIds.get('payments')}/config`)
        .set(as('admin-a@example.com', 'tenant-a'))
        .send({ environmentId, key: 'API_KEY', value: 'super-secret-value', isSecret: true });
      if (secret.status !== 201 || secret.body.value !== null) {
        throw new Error(`Setup failed: ${secret.status}`);
      }
      secretId = secret.body.id;
    });

    it('does not let tenant B read tenant A configuration', async () => {
      const viaOwnTenant = await request(server)
        .get(`/api/tenant/projects/${projectIds.get('payments')}/config`)
        .set(as('owner-b@example.com', 'tenant-b'));
      const viaForgedTenant = await request(server)
        .get(`/api/tenant/projects/${projectIds.get('payments')}/config`)
        .set(as('owner-b@example.com', 'tenant-a'));
      const viaOwnProject = await request(server)
        .patch(`/api/tenant/projects/${projectIds.get('billing')}/config/${configId}`)
        .set(as('owner-b@example.com', 'tenant-b'))
        .send({ value: 'hijacked' });
      expect(viaOwnTenant.status).toBe(404);
      expect(viaForgedTenant.status).toBe(404);
      expect(viaOwnProject.status).toBe(404);
    });

    it('rejects configuration for an environment of another project', async () => {
      const billing = await request(server)
        .get(`/api/tenant/projects/${projectIds.get('billing')}`)
        .set(as('owner-b@example.com', 'tenant-b'));
      const res = await request(server)
        .post(`/api/tenant/projects/${projectIds.get('payments')}/config`)
        .set(as('admin-a@example.com', 'tenant-a'))
        .send({ environmentId: billing.body.environments[0].id, key: 'X', value: 'y' });
      expect(res.status).toBe(404);
    });

    it('masks secrets in listings for every role', async () => {
      const res = await request(server)
        .get(`/api/tenant/projects/${projectIds.get('payments')}/config`)
        .set(as('viewer-a@example.com', 'tenant-a'));
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain('super-secret-value');
      const secret = res.body.items.find((c: { key: string }) => c.key === 'API_KEY');
      expect(secret).toMatchObject({ isSecret: true, value: null });
    });

    it('does not reveal secret values to viewers or developers', async () => {
      for (const email of ['viewer-a@example.com', 'dev-a@example.com']) {
        const res = await request(server)
          .get(`/api/tenant/projects/${projectIds.get('payments')}/config/${secretId}/secret`)
          .set(as(email, 'tenant-a'));
        expect(res.status).toBe(403);
        expect(JSON.stringify(res.body)).not.toContain('super-secret-value');
      }
    });

    it('reveals secrets to admins and audits the access without the value', async () => {
      const res = await request(server)
        .get(`/api/tenant/projects/${projectIds.get('payments')}/config/${secretId}/secret`)
        .set(as('admin-a@example.com', 'tenant-a'));
      expect(res.status).toBe(200);
      expect(res.body.value).toBe('super-secret-value');

      const audit = await request(server)
        .get('/api/tenant/audit')
        .set(as('owner-a@example.com', 'tenant-a'));
      const actions = audit.body.items.map((e: { action: string }) => e.action);
      expect(actions).toContain('SECRET_ACCESSED');
      expect(JSON.stringify(audit.body)).not.toContain('super-secret-value');
    });

    it('never stores secret plaintext in the database', async () => {
      const configs = await knex('configurations').select();
      const secrets = await knex('secrets').select();
      expect(JSON.stringify([configs, secrets])).not.toContain('super-secret-value');
    });

    it('lets developers write non-secret config but viewers nothing', async () => {
      const path = `/api/tenant/projects/${projectIds.get('payments')}/config/${configId}`;
      const dev = await request(server)
        .patch(path)
        .set(as('dev-a@example.com', 'tenant-a'))
        .send({ value: 'https://api2.a.example' });
      const viewer = await request(server)
        .patch(path)
        .set(as('viewer-a@example.com', 'tenant-a'))
        .send({ value: 'nope' });
      expect(dev.status).toBe(200);
      expect(viewer.status).toBe(403);
    });

    it('rejects duplicate keys in the same environment', async () => {
      const res = await request(server)
        .post(`/api/tenant/projects/${projectIds.get('payments')}/config`)
        .set(as('admin-a@example.com', 'tenant-a'))
        .send({ environmentId, key: 'API_URL', value: 'dup' });
      expect(res.status).toBe(409);
    });
  });

  describe('role authorization', () => {
    it('forbids viewers from creating projects', async () => {
      const res = await request(server)
        .post('/api/tenant/projects')
        .set(as('viewer-a@example.com', 'tenant-a'))
        .send({ name: 'Nope', slug: 'nope' });
      expect(res.status).toBe(403);
    });

    it('forbids developers from managing members', async () => {
      const res = await request(server)
        .post('/api/tenant/members')
        .set(as('dev-a@example.com', 'tenant-a'))
        .send({ email: 'new@example.com', role: 'VIEWER' });
      expect(res.status).toBe(403);
    });

    it('lets admins create projects', async () => {
      const res = await request(server)
        .post('/api/tenant/projects')
        .set(as('admin-a@example.com', 'tenant-a'))
        .send({ name: 'E-commerce Platform', slug: 'ecommerce', environments: ['development', 'production'] });
      expect(res.status).toBe(201);
      expect(res.body.tenantId).toBe(tenantIds.get('tenant-a'));
      expect(res.body.environments).toHaveLength(2);
    });

    it('creates a project without environments and adds them afterwards', async () => {
      const created = await request(server)
        .post('/api/tenant/projects')
        .set(as('admin-a@example.com', 'tenant-a'))
        .send({ name: 'Empty Project', slug: 'empty-project', environments: [] });
      expect(created.status).toBe(201);
      expect(created.body.environments).toHaveLength(0);
      const path = `/api/tenant/projects/${created.body.id}/environments`;

      const added = await request(server)
        .post(path)
        .set(as('admin-a@example.com', 'tenant-a'))
        .send({ name: 'development' });
      expect(added.status).toBe(201);

      const duplicate = await request(server)
        .post(path)
        .set(as('admin-a@example.com', 'tenant-a'))
        .send({ name: 'development' });
      expect(duplicate.status).toBe(409);

      const byViewer = await request(server)
        .post(path)
        .set(as('viewer-a@example.com', 'tenant-a'))
        .send({ name: 'staging' });
      // Viewers are not assigned to the new project, so it does not exist for them
      expect(byViewer.status).toBe(404);

      const byOtherTenant = await request(server)
        .post(path)
        .set(as('owner-b@example.com', 'tenant-b'))
        .send({ name: 'staging' });
      expect(byOtherTenant.status).toBe(404);

      const list = await request(server)
        .get(path)
        .set(as('admin-a@example.com', 'tenant-a'));
      expect(list.body.items.map((e: { name: string }) => e.name)).toEqual(['development']);
    });

    it('allows the same project slug in different tenants but not twice in one', async () => {
      const otherTenant = await request(server)
        .post('/api/tenant/projects')
        .set(as('owner-b@example.com', 'tenant-b'))
        .send({ name: 'Payments B', slug: 'payments' });
      const sameTenant = await request(server)
        .post('/api/tenant/projects')
        .set(as('owner-a@example.com', 'tenant-a'))
        .send({ name: 'Payments again', slug: 'payments' });
      expect(otherTenant.status).toBe(201);
      expect(sameTenant.status).toBe(409);
    });
  });

  describe('project assignments', () => {
    const projectsOf = async (email: string) => {
      const res = await request(server).get('/api/tenant/projects').set(as(email, 'tenant-a'));
      return res.body.items.map((p: { slug: string }) => p.slug);
    };

    it('shows owners and admins every project, others only assigned ones', async () => {
      expect(await projectsOf('admin-a@example.com')).toEqual(
        expect.arrayContaining(['payments', 'internal']),
      );
      expect(await projectsOf('dev-a@example.com')).toEqual(['payments']);
      expect(await projectsOf('viewer-a@example.com')).toEqual(['payments']);
    });

    it('returns 404 for unassigned projects and their configuration', async () => {
      const id = projectIds.get('internal');
      const project = await request(server)
        .get(`/api/tenant/projects/${id}`)
        .set(as('dev-a@example.com', 'tenant-a'));
      const config = await request(server)
        .get(`/api/tenant/projects/${id}/config`)
        .set(as('dev-a@example.com', 'tenant-a'));
      expect(project.status).toBe(404);
      expect(config.status).toBe(404);
    });

    it('hides the member list from developers and viewers', async () => {
      for (const email of ['dev-a@example.com', 'viewer-a@example.com']) {
        const res = await request(server).get('/api/tenant/members').set(as(email, 'tenant-a'));
        expect(res.status).toBe(403);
      }
    });

    it('lets admins assign tenant members only, and not developers', async () => {
      const path = `/api/tenant/projects/${projectIds.get('internal')}/members`;
      const byDev = await request(server)
        .put(`${path}/${userIds.get('viewer-a@example.com')}`)
        .set(as('dev-a@example.com', 'tenant-a'));
      const foreign = await request(server)
        .put(`${path}/${userIds.get('owner-b@example.com')}`)
        .set(as('admin-a@example.com', 'tenant-a'));
      const ok = await request(server)
        .put(`${path}/${userIds.get('viewer-a@example.com')}`)
        .set(as('admin-a@example.com', 'tenant-a'));
      expect(byDev.status).toBe(404);
      expect(foreign.status).toBe(400);
      expect(ok.status).toBe(200);
      expect(await projectsOf('viewer-a@example.com')).toEqual(['internal', 'payments']);

      const removed = await request(server)
        .delete(`${path}/${userIds.get('viewer-a@example.com')}`)
        .set(as('admin-a@example.com', 'tenant-a'));
      expect(removed.status).toBe(204);
      expect(await projectsOf('viewer-a@example.com')).toEqual(['payments']);
    });
  });

  describe('platform admin', () => {
    it('lets platform admins see all tenants, users and projects', async () => {
      const [tenants, users, projects] = await Promise.all(
        ['tenants', 'users', 'projects'].map(path =>
          request(server).get(`/api/tenant/admin/${path}`).set(as('owner-a@example.com')),
        ),
      );
      expect(tenants.status).toBe(200);
      expect(tenants.body.items.map((t: { slug: string }) => t.slug)).toEqual(
        expect.arrayContaining(['tenant-a', 'tenant-b']),
      );
      expect(users.body.items.length).toBeGreaterThanOrEqual(seed.users.length);
      expect(projects.body.items.map((p: { slug: string }) => p.slug)).toEqual(
        expect.arrayContaining(['payments', 'billing']),
      );
    });

    it('forbids platform data to everyone else, including tenant owners', async () => {
      for (const email of ['owner-b@example.com', 'admin-a@example.com', 'dev-a@example.com']) {
        const res = await request(server).get('/api/tenant/admin/projects').set(as(email));
        expect(res.status).toBe(403);
      }
    });
  });

  describe('platform admin department management', () => {
    it('only lets platform admins update, delete or manage members of any tenant', async () => {
      const b = tenantIds.get('tenant-b');
      for (const email of ['owner-b@example.com', 'dev-a@example.com']) {
        const patch = await request(server)
          .patch(`/api/tenant/admin/tenants/${b}`)
          .set(as(email))
          .send({ status: 'suspended' });
        const del = await request(server).delete(`/api/tenant/admin/tenants/${b}`).set(as(email));
        const members = await request(server)
          .get(`/api/tenant/admin/tenants/${b}/members`)
          .set(as(email));
        const add = await request(server)
          .post(`/api/tenant/admin/tenants/${b}/members`)
          .set(as(email))
          .send({ email: 'intruder@example.com', role: 'OWNER' });
        expect([patch.status, del.status, members.status, add.status]).toEqual([403, 403, 403, 403]);
      }
    });

    it('lists tenant admins with their sign-in state and filters projects by tenant', async () => {
      const tenants = await request(server)
        .get('/api/tenant/admin/tenants')
        .set(as('owner-a@example.com'));
      const b = tenants.body.items.find((t: { slug: string }) => t.slug === 'tenant-b');
      expect(b.admins).toEqual([
        expect.objectContaining({ email: 'owner-b@example.com', role: 'OWNER' }),
      ]);
      // Resolved at sign-in in beforeAll
      expect(b.admins[0].lastSignInAt).toBeDefined();

      const projects = await request(server)
        .get(`/api/tenant/admin/projects?tenantId=${tenantIds.get('tenant-b')}`)
        .set(as('owner-a@example.com'));
      const items: Array<{ slug: string; tenantId: string }> = projects.body.items;
      expect(items.map(p => p.slug)).toContain('billing');
      expect(items.every(p => p.tenantId === tenantIds.get('tenant-b'))).toBe(true);
    });

    it('returns 404 for unknown tenants', async () => {
      const res = await request(server)
        .get('/api/tenant/admin/tenants/00000000-0000-4000-8000-000000000000')
        .set(as('owner-a@example.com'));
      expect(res.status).toBe(404);
    });
  });

  describe('invites', () => {
    let inviteToken: string;
    let secondToken: string;

    it('gives new owners without a password a one-time invite', async () => {
      const res = await request(server)
        .post('/api/tenant/tenants')
        .set(as('owner-a@example.com'))
        .send({
          name: 'Tenant Invite',
          slug: 'tenant-invite',
          ownerEmail: 'invited-1@example.com',
          ownerName: 'Invited One',
          additionalOwners: [
            { email: 'invited-2@example.com', name: 'Invited Two' },
            // Existing users get no invite and keep their password
            { email: 'owner-b@example.com' },
          ],
        });
      expect(res.status).toBe(201);
      const owners: Array<{ email: string; accountCreated: boolean; invite?: { token: string } }> =
        res.body.owners;
      expect(owners.map(o => [o.email, o.accountCreated, !!o.invite])).toEqual([
        ['invited-1@example.com', true, true],
        ['invited-2@example.com', true, true],
        ['owner-b@example.com', false, false],
      ]);
      inviteToken = owners[0].invite!.token;
      secondToken = owners[1].invite!.token;
    });

    it('never stores invite tokens in plain text', async () => {
      const rows = await knex('user_invites').select('token_hash');
      expect(rows.length).toBeGreaterThan(0);
      expect(JSON.stringify(rows)).not.toContain(inviteToken);
    });

    it('cannot sign in before the invite is accepted', async () => {
      const login = await request(server)
        .post('/api/tenant/session/login')
        .send({ email: 'invited-1@example.com', password: 'anything-goes-here' });
      expect(login.status).toBe(401);
    });

    it('looks up and accepts an invite once', async () => {
      const lookup = await request(server)
        .post('/api/tenant/session/invite/lookup')
        .send({ token: inviteToken });
      expect(lookup.status).toBe(200);
      expect(lookup.body).toMatchObject({ email: 'invited-1@example.com', name: 'Invited One' });

      const weak = await request(server)
        .post('/api/tenant/session/invite/accept')
        .send({ token: inviteToken, password: 'short' });
      expect(weak.status).toBe(400);

      const accept = await request(server)
        .post('/api/tenant/session/invite/accept')
        .send({ token: inviteToken, password: 'my-new-password-123' });
      expect(accept.status).toBe(200);

      const login = await request(server)
        .post('/api/tenant/session/login')
        .send({ email: 'invited-1@example.com', password: 'my-new-password-123' });
      expect(login.status).toBe(204);

      const reuse = await request(server)
        .post('/api/tenant/session/invite/accept')
        .send({ token: inviteToken, password: 'another-password-123' });
      expect(reuse.status).toBe(404);
    });

    it('rejects unknown and expired invites with the same error', async () => {
      const unknown = await request(server)
        .post('/api/tenant/session/invite/lookup')
        .send({ token: 'x'.repeat(43) });
      expect(unknown.status).toBe(404);

      await knex('user_invites').update({ expires_at: new Date(Date.now() - 1000) });
      const expired = await request(server)
        .post('/api/tenant/session/invite/lookup')
        .send({ token: secondToken });
      expect(expired.status).toBe(404);
      expect(expired.body.error.message).toBe(unknown.body.error.message);
    });

    it('lets only platform admins regenerate links, and only for users without a password', async () => {
      const me = await request(server)
        .get(`/api/tenant/admin/tenants`)
        .set(as('owner-a@example.com'));
      const tenant = me.body.items.find((t: { slug: string }) => t.slug === 'tenant-invite');
      const members = await request(server)
        .get(`/api/tenant/admin/tenants/${tenant.id}/members`)
        .set(as('owner-a@example.com'));
      const byEmail = (email: string) =>
        members.body.items.find((m: { email: string }) => m.email === email);
      expect(byEmail('invited-2@example.com').hasPassword).toBe(false);
      expect(byEmail('invited-1@example.com').hasPassword).toBe(true);

      const denied = await request(server)
        .post(`/api/tenant/admin/users/${byEmail('invited-2@example.com').userId}/invite`)
        .set(as('owner-b@example.com'));
      expect(denied.status).toBe(403);

      const regenerated = await request(server)
        .post(`/api/tenant/admin/users/${byEmail('invited-2@example.com').userId}/invite`)
        .set(as('owner-a@example.com'));
      expect(regenerated.status).toBe(201);
      const lookup = await request(server)
        .post('/api/tenant/session/invite/lookup')
        .send({ token: regenerated.body.token });
      expect(lookup.body.email).toBe('invited-2@example.com');

      // Never a password reset for accounts that have one
      const takeover = await request(server)
        .post(`/api/tenant/admin/users/${byEmail('invited-1@example.com').userId}/invite`)
        .set(as('owner-a@example.com'));
      expect(takeover.status).toBe(400);
    });
  });

  describe('tenant switching', () => {
    it('applies the role of the tenant being switched to', async () => {
      const toA = await request(server)
        .post('/api/tenant/switch')
        .set(as('multi@example.com'))
        .send({ tenantId: tenantIds.get('tenant-a') });
      expect(toA.body.role).toBe('ADMIN');
      expect(toA.body.permissions).toContain('project.create');

      const toB = await request(server)
        .post('/api/tenant/switch')
        .set(as('multi@example.com'))
        .send({ tenantId: tenantIds.get('tenant-b') });
      expect(toB.body.role).toBe('VIEWER');
      expect(toB.body.permissions).not.toContain('project.create');

      const createInB = await request(server)
        .post('/api/tenant/projects')
        .set(as('multi@example.com', 'tenant-b'))
        .send({ name: 'Sneaky', slug: 'sneaky' });
      expect(createInB.status).toBe(403);
    });

    it('cannot switch into a tenant without membership', async () => {
      const res = await request(server)
        .post('/api/tenant/switch')
        .set(as('dev-a@example.com'))
        .send({ tenantId: tenantIds.get('tenant-b') });
      expect(res.status).toBe(404);
    });
  });

  describe('privilege escalation', () => {
    it('does not let a developer make themselves OWNER', async () => {
      const res = await request(server)
        .patch(`/api/tenant/members/${userIds.get('dev-a@example.com')}`)
        .set(as('dev-a@example.com', 'tenant-a'))
        .send({ role: 'OWNER' });
      expect(res.status).toBe(403);
    });

    it('does not let admins grant OWNER or modify owners', async () => {
      const grant = await request(server)
        .patch(`/api/tenant/members/${userIds.get('viewer-a@example.com')}`)
        .set(as('admin-a@example.com', 'tenant-a'))
        .send({ role: 'OWNER' });
      const demote = await request(server)
        .patch(`/api/tenant/members/${userIds.get('owner-a@example.com')}`)
        .set(as('admin-a@example.com', 'tenant-a'))
        .send({ role: 'VIEWER' });
      expect(grant.status).toBe(403);
      expect(demote.status).toBe(403);
    });

    it('does not let owners change their own role', async () => {
      const res = await request(server)
        .patch(`/api/tenant/members/${userIds.get('owner-a@example.com')}`)
        .set(as('owner-a@example.com', 'tenant-a'))
        .send({ role: 'VIEWER' });
      expect(res.status).toBe(403);
    });

    it('does not let an owner modify members of another tenant', async () => {
      const res = await request(server)
        .patch(`/api/tenant/members/${userIds.get('owner-b@example.com')}`)
        .set(as('owner-a@example.com', 'tenant-a'))
        .send({ role: 'VIEWER' });
      expect(res.status).toBe(404);
    });

    it('does not set passwords for existing users when adding them to a tenant', async () => {
      const add = await request(server)
        .post('/api/tenant/members')
        .set(as('owner-b@example.com', 'tenant-b'))
        .send({ email: 'owner-a@example.com', role: 'VIEWER', password: 'attacker-password' });
      expect(add.status).toBe(201);

      const login = await request(server)
        .post('/api/tenant/session/login')
        .send({ email: 'owner-a@example.com', password: 'attacker-password' });
      expect(login.status).toBe(401);
    });

    it('lets owners change roles and audits it', async () => {
      const res = await request(server)
        .patch(`/api/tenant/members/${userIds.get('viewer-a@example.com')}`)
        .set(as('owner-a@example.com', 'tenant-a'))
        .send({ role: 'DEVELOPER' });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe('DEVELOPER');

      const audit = await request(server)
        .get('/api/tenant/audit')
        .set(as('owner-a@example.com', 'tenant-a'));
      expect(audit.body.items.map((e: { action: string }) => e.action)).toContain('ROLE_CHANGED');
    });

    it('only lets platform admins create tenants', async () => {
      const denied = await request(server)
        .post('/api/tenant/tenants')
        .set(as('owner-b@example.com'))
        .send({ name: 'Tenant C', slug: 'tenant-c' });
      const allowed = await request(server)
        .post('/api/tenant/tenants')
        .set(as('owner-a@example.com'))
        .send({ name: 'Tenant C', slug: 'tenant-c' });
      expect(denied.status).toBe(403);
      expect(allowed.status).toBe(201);
    });
  });

  describe('tenant creation with a new owner account', () => {
    const ownerEmail = 'new-owner@tenant-d.example';
    const ownerPassword = 'new-owner-password';

    it('rejects duplicate owners', async () => {
      const res = await request(server)
        .post('/api/tenant/tenants')
        .set(as('owner-a@example.com'))
        .send({
          name: 'Tenant Dup',
          slug: 'tenant-dup',
          ownerEmail: 'dup@example.com',
          additionalOwners: [{ email: 'DUP@example.com' }],
        });
      expect(res.status).toBe(400);
    });

    it('creates the owner account so the owner can sign in to their tenant', async () => {
      const created = await request(server)
        .post('/api/tenant/tenants')
        .set(as('owner-a@example.com'))
        .send({
          name: 'Tenant D',
          slug: 'tenant-d',
          ownerEmail,
          ownerName: 'Dana',
          ownerPassword,
        });
      expect(created.status).toBe(201);
      expect(created.body.owner).toMatchObject({ email: ownerEmail, accountCreated: true });

      const login = await request(server)
        .post('/api/tenant/session/login')
        .send({ email: ownerEmail, password: ownerPassword });
      expect(login.status).toBe(204);

      const resolved = await request(server)
        .post('/api/tenant/internal/resolve-user')
        .set('Authorization', mockCredentials.service.header())
        .send({ email: ownerEmail, provider: 'test' });
      expect(resolved.status).toBe(200);

      const me = await request(server)
        .get('/api/tenant/me')
        .set('Authorization', mockCredentials.user.header(resolved.body.userEntityRef));
      expect(me.body.tenants).toEqual([
        expect.objectContaining({ slug: 'tenant-d', role: 'OWNER' }),
      ]);

      // The creating platform admin does not become a member
      const adminMe = await request(server).get('/api/tenant/me').set(as('owner-a@example.com'));
      expect(adminMe.body.tenants.map((t: { slug: string }) => t.slug)).not.toContain('tenant-d');
    });

    it('never overwrites the password of an existing owner', async () => {
      const res = await request(server)
        .post('/api/tenant/tenants')
        .set(as('owner-a@example.com'))
        .send({
          name: 'Tenant E',
          slug: 'tenant-e',
          ownerEmail,
          ownerPassword: 'attacker-chosen-password',
        });
      expect(res.status).toBe(201);
      expect(res.body.owner.accountCreated).toBe(false);

      const login = await request(server)
        .post('/api/tenant/session/login')
        .send({ email: ownerEmail, password: 'attacker-chosen-password' });
      expect(login.status).toBe(401);
    });
  });

  describe('plugin switches', () => {
    const access = (headers: Record<string, string>, path = '/api/scaffolder/v2/tasks') =>
      request(server).post('/api/tenant/internal/plugin-access').set(headers).send({ path });

    it('enables every plugin by default', async () => {
      const res = await request(server)
        .get('/api/tenant/plugins')
        .set(as('viewer-a@example.com', 'tenant-a'));
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      expect(res.body.items.every((p: { enabled: boolean }) => p.enabled)).toBe(true);
    });

    it('only lets owners and admins change plugins', async () => {
      const res = await request(server)
        .put('/api/tenant/plugins/scaffolder')
        .set(as('dev-a@example.com', 'tenant-a'))
        .send({ enabled: false });
      expect(res.status).toBe(403);
    });

    it('rejects unknown plugins', async () => {
      const res = await request(server)
        .put('/api/tenant/plugins/not-a-plugin')
        .set(as('admin-a@example.com', 'tenant-a'))
        .send({ enabled: false });
      expect(res.status).toBe(400);
    });

    it('turns a plugin off for one tenant only', async () => {
      const off = await request(server)
        .put('/api/tenant/plugins/scaffolder')
        .set(as('admin-a@example.com', 'tenant-a'))
        .send({ enabled: false });
      expect(off.status).toBe(200);
      expect(off.body).toMatchObject({ id: 'scaffolder', enabled: false });

      const b = await request(server)
        .get('/api/tenant/plugins')
        .set(as('owner-b@example.com', 'tenant-b'));
      expect(b.body.items).toContainEqual(expect.objectContaining({ id: 'scaffolder', enabled: true }));
    });

    it('blocks the plugin backend for members of that tenant', async () => {
      const denied = await access(as('dev-a@example.com', 'tenant-a'));
      expect(denied.body).toMatchObject({ allowed: false, pluginId: 'scaffolder' });

      // Without a tenant header, one tenant with the plugin on is enough
      expect((await access(as('dev-a@example.com'))).body.allowed).toBe(false);
      expect((await access(as('multi@example.com'))).body.allowed).toBe(true);
      expect((await access(as('multi@example.com', 'tenant-a'))).body.allowed).toBe(false);
      expect((await access(as('owner-b@example.com', 'tenant-b'))).body.allowed).toBe(true);
    });

    it('does not let a tenant header grant access to a foreign tenant', async () => {
      const res = await access(as('dev-a@example.com', 'tenant-b'));
      expect(res.body.allowed).toBe(false);
    });

    it('always allows services and plugins that cannot be turned off', async () => {
      const service = await access({ Authorization: mockCredentials.service.header() });
      expect(service.body.allowed).toBe(true);
      const catalog = await access(as('dev-a@example.com', 'tenant-a'), '/api/catalog/entities');
      expect(catalog.body.allowed).toBe(true);
    });
  });
});
