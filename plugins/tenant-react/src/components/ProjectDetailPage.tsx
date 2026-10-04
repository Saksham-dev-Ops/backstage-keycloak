import { useState } from 'react';
import {
  Link as RouterLink,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  Content,
  ContentHeader,
  InfoCard,
  Progress,
  ResponseErrorPanel,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import Grid from '@material-ui/core/Grid';
import MenuItem from '@material-ui/core/MenuItem';
import Tab from '@material-ui/core/Tab';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Tabs from '@material-ui/core/Tabs';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import { ProjectDetails, Role, ROLES, tenantApiRef } from '../api';
import { useTenant } from '../useTenant';
import { ConfigTab } from './ConfigTab';
import { ProjectTeamTab } from './ProjectTeamTab';
import { confirmAction, useAction, useLoader } from './shared';

const ROLE_RANK: Record<Role, number> = { OWNER: 4, ADMIN: 3, DEVELOPER: 2, VIEWER: 1 };

const SUGGESTED_ENVIRONMENTS = ['development', 'staging', 'production'];

function OverviewTab(props: { project: ProjectDetails; onChanged: () => void }) {
  const { project } = props;
  const tenantApi = useApi(tenantApiRef);
  const { can } = useTenant();
  const run = useAction();
  const navigate = useNavigate();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const editable = can('project.update');

  return (
    <InfoCard title="Overview">
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField label="Name" value={name} onChange={e => setName(e.target.value)} disabled={!editable} fullWidth margin="dense" />
          <TextField label="Slug" value={project.slug} disabled fullWidth margin="dense" />
          <TextField
            label="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={!editable}
            fullWidth
            multiline
            margin="dense"
          />
          <Typography variant="body2" color="textSecondary" style={{ marginTop: 8 }}>
            {project.environments.length} environments · created {new Date(project.createdAt).toLocaleString()}
          </Typography>
        </Grid>
      </Grid>
      <div style={{ marginTop: 16 }}>
        {editable && (
          <Button
            color="primary"
            variant="contained"
            style={{ marginRight: 8 }}
            onClick={async () => {
              if (await run(() => tenantApi.updateProject(project.id, { name, description }), 'Project updated')) {
                props.onChanged();
              }
            }}
          >
            Save
          </Button>
        )}
        {can('project.delete') && (
          <Button
            color="secondary"
            variant="outlined"
            onClick={async () => {
              if (
                confirmAction(`Delete project '${project.name}' with all environments, configuration and secrets?`) &&
                (await run(() => tenantApi.deleteProject(project.id), 'Project deleted'))
              ) {
                navigate('..');
              }
            }}
          >
            Delete project
          </Button>
        )}
      </div>
    </InfoCard>
  );
}

function EnvironmentsTab(props: { project: ProjectDetails; onChanged: () => void }) {
  const { project } = props;
  const tenantApi = useApi(tenantApiRef);
  const { can } = useTenant();
  const run = useAction();
  const [name, setName] = useState('');
  const canManage = can('environment.manage');
  const existing = new Set(project.environments.map(env => env.name));
  const suggestions = SUGGESTED_ENVIRONMENTS.filter(env => !existing.has(env));

  const add = async (environmentName: string) => {
    const ok = await run(
      () => tenantApi.createEnvironment(project.id, environmentName),
      `Environment '${environmentName}' added`,
    );
    if (ok) {
      props.onChanged();
    }
    return ok;
  };

  return (
    <InfoCard title="Environments">
      {!project.environments.length && (
        <Typography variant="body2" color="textSecondary" paragraph>
          This project has no environments yet.{' '}
          {canManage
            ? 'Add one below; configuration and secrets are managed per environment.'
            : 'Ask an organization owner or admin to add them.'}
        </Typography>
      )}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Created</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {project.environments.map(env => (
            <TableRow key={env.id}>
              <TableCell>{env.name}</TableCell>
              <TableCell>{new Date(env.createdAt).toLocaleDateString()}</TableCell>
              <TableCell align="right">
                {canManage && (
                  <Button
                    size="small"
                    color="secondary"
                    onClick={async () => {
                      if (
                        confirmAction(`Delete environment '${env.name}' and all of its configuration?`) &&
                        (await run(() => tenantApi.deleteEnvironment(project.id, env.id), `${env.name} deleted`))
                      ) {
                        props.onChanged();
                      }
                    }}
                  >
                    Delete
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {canManage && suggestions.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="body2">Quick add:</Typography>
          {suggestions.map(env => (
            <Chip key={env} label={`+ ${env}`} clickable color="primary" variant="outlined" onClick={() => add(env)} />
          ))}
        </div>
      )}
      {canManage && (
        <form
          style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}
          onSubmit={async e => {
            e.preventDefault();
            if (await add(name.trim().toLowerCase())) {
              setName('');
            }
          }}
        >
          <TextField
            label="Custom environment"
            value={name}
            onChange={e => setName(e.target.value)}
            helperText="Lowercase letters, digits, - or _ (e.g. qa, uat, prod-eu)"
            size="small"
            variant="outlined"
            required
          />
          <Button type="submit" color="primary" variant="contained">
            Add
          </Button>
        </form>
      )}
    </InfoCard>
  );
}

export function MembersTab() {
  const tenantApi = useApi(tenantApiRef);
  const { can, role: ownRole, user } = useTenant();
  const run = useAction();
  const members = useLoader(() => tenantApi.listMembers(), [tenantApi]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('VIEWER');

  const canManage = can('member.manage');
  // Mirrors the backend rules; the backend enforces them regardless
  const assignable = ROLES.filter(r => ownRole && ROLE_RANK[r] <= ROLE_RANK[ownRole]);
  const canManageMember = (memberRole: Role, userId: string) =>
    canManage && userId !== user?.id && !!ownRole && ROLE_RANK[memberRole] <= ROLE_RANK[ownRole];

  return (
    <InfoCard title="Members of this organization">
      {members.loading && !members.value && <Progress />}
      {members.error && <ResponseErrorPanel error={members.error} />}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Email</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Role</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {members.value?.map(member => (
            <TableRow key={member.userId}>
              <TableCell>{member.email}</TableCell>
              <TableCell>{member.name}</TableCell>
              <TableCell>
                {canManageMember(member.role, member.userId) ? (
                  <TextField
                    select
                    size="small"
                    value={member.role}
                    onChange={async e => {
                      const next = e.target.value as Role;
                      if (await run(() => tenantApi.updateMemberRole(member.userId, next), `${member.email} is now ${next}`)) {
                        members.reload();
                      }
                    }}
                  >
                    {assignable.map(r => (
                      <MenuItem key={r} value={r}>
                        {r}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  member.role
                )}
              </TableCell>
              <TableCell align="right">
                {canManageMember(member.role, member.userId) && (
                  <Button
                    size="small"
                    color="secondary"
                    onClick={async () => {
                      if (
                        confirmAction(`Remove ${member.email} from this organization?`) &&
                        (await run(() => tenantApi.removeMember(member.userId), `${member.email} removed`))
                      ) {
                        members.reload();
                      }
                    }}
                  >
                    Remove
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {canManage && (
        <form
          style={{ marginTop: 24 }}
          onSubmit={async e => {
            e.preventDefault();
            const ok = await run(
              () =>
                tenantApi.addMember({
                  email: email.trim(),
                  name: name.trim() || undefined,
                  role,
                  password: password || undefined,
                }),
              `${email} added`,
            );
            if (ok) {
              setEmail('');
              setName('');
              setPassword('');
              members.reload();
            }
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            Add member
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} size="small" variant="outlined" fullWidth required />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField label="Name" value={name} onChange={e => setName(e.target.value)} size="small" variant="outlined" fullWidth />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                label="Initial password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                helperText="New users only, min. 12 chars"
                size="small"
                variant="outlined"
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField select label="Role" value={role} onChange={e => setRole(e.target.value as Role)} size="small" variant="outlined" fullWidth>
                {assignable.map(r => (
                  <MenuItem key={r} value={r}>
                    {r}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button type="submit" color="primary" variant="contained">
                Add
              </Button>
            </Grid>
          </Grid>
        </form>
      )}
    </InfoCard>
  );
}

export function AuditTab() {
  const tenantApi = useApi(tenantApiRef);
  const logs = useLoader(() => tenantApi.listAuditLogs(), [tenantApi]);
  return (
    <InfoCard title="Audit log">
      {logs.loading && !logs.value && <Progress />}
      {logs.error && <ResponseErrorPanel error={logs.error} />}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Time</TableCell>
            <TableCell>Action</TableCell>
            <TableCell>Resource</TableCell>
            <TableCell>Details</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {logs.value?.map(log => (
            <TableRow key={log.id}>
              <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
              <TableCell>{log.action}</TableCell>
              <TableCell>{log.resourceType}</TableCell>
              <TableCell style={{ fontFamily: 'monospace', fontSize: 12 }}>
                {log.metadata ? JSON.stringify(log.metadata) : ''}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </InfoCard>
  );
}

export function ProjectDetailPage() {
  const { projectId = '' } = useParams();
  const tenantApi = useApi(tenantApiRef);
  const { can } = useTenant();
  const project = useLoader(() => tenantApi.getProject(projectId), [tenantApi, projectId]);
  // The tab lives in the URL (?tab=environments) so it can be linked to
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') ?? 'overview';
  const setTab = (next: string) => setSearchParams({ tab: next }, { replace: true });

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'config', label: 'Configuration' },
    { id: 'environments', label: 'Environments' },
    { id: 'secrets', label: 'Secrets' },
    { id: 'team', label: 'Team' },
    ...(can('audit.read') ? [{ id: 'audit', label: 'Audit' }] : []),
  ];

  if (project.error) {
    return (
      <Content>
        <ResponseErrorPanel error={project.error} />
        <Button component={RouterLink} to=".." style={{ marginTop: 16 }}>
          Back to projects
        </Button>
      </Content>
    );
  }
  if (!project.value) {
    return <Progress />;
  }

  const value = project.value;
  return (
    <Content>
      <ContentHeader title={value.name} description={value.description}>
        <Button component={RouterLink} to="..">
          All projects
        </Button>
      </ContentHeader>
      <Tabs value={tab} onChange={(_e, next) => setTab(next)} indicatorColor="primary" style={{ marginBottom: 16 }}>
        {tabs.map(t => (
          <Tab key={t.id} value={t.id} label={t.label} />
        ))}
      </Tabs>
      {tab === 'overview' && <OverviewTab project={value} onChanged={project.reload} />}
      {tab === 'config' && <ConfigTab project={value} />}
      {tab === 'environments' && <EnvironmentsTab project={value} onChanged={project.reload} />}
      {tab === 'secrets' && <ConfigTab project={value} secretsOnly />}
      {tab === 'team' && <ProjectTeamTab project={value} />}
      {tab === 'audit' && <AuditTab />}
    </Content>
  );
}
