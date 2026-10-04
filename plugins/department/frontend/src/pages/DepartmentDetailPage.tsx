import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Tab from '@material-ui/core/Tab';
import Tabs from '@material-ui/core/Tabs';
import AccountBalanceOutlinedIcon from '@material-ui/icons/AccountBalanceOutlined';
import AddIcon from '@material-ui/icons/Add';
import EditOutlinedIcon from '@material-ui/icons/EditOutlined';
import FolderOpenOutlinedIcon from '@material-ui/icons/FolderOpenOutlined';
import PeopleOutlineIcon from '@material-ui/icons/PeopleOutline';
import { departmentApiRef } from '../api/DepartmentApi';
import {
  ConfirmDialog,
  ErrorState,
  GridIcon,
  LoadingState,
  SectionCard,
  StatCard,
  StatGrid,
  StatusChip,
} from '../components/Common';
import { DepartmentForm } from '../components/DepartmentForm';
import { ConsolePage } from '../components/Layout';
import { ProjectList } from '../components/ProjectList';
import { UserForm } from '../components/UserForm';
import { UserList } from '../components/UserList';
import { useAsync } from '../hooks';
import { DepartmentUser } from '../types';
import { usage } from '../utils/format';
import { tokens } from '../utils/tokens';

const useStyles = makeStyles({
  tabs: {
    padding: '0 20px',
    borderTop: `1px solid ${tokens.border}`,
    minHeight: 44,
    '& .MuiTab-root': {
      textTransform: 'none',
      fontSize: 14,
      fontWeight: 500,
      minHeight: 44,
    },
    '& .Mui-selected': { color: tokens.primary },
    '& .MuiTabs-indicator': { background: tokens.primary },
  },
  button: {
    textTransform: 'none',
    borderRadius: tokens.radiusSm,
    fontWeight: 500,
  },
  ministry: {
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 1.35,
    display: 'block',
  },
});

/** One department: usage, users and projects. */
export function DepartmentDetailPage() {
  const classes = useStyles();
  const { departmentId = '' } = useParams();
  const api = useApi(departmentApiRef);
  const alertApi = useApi(alertApiRef);
  const [tab, setTab] = useState<'users' | 'projects'>('users');
  const [editing, setEditing] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [removing, setRemoving] = useState<DepartmentUser>();

  const department = useAsync(
    () => api.getDepartment(departmentId),
    [api, departmentId],
  );
  const ministries = useAsync(() => api.listMinistries(), [api]);
  const users = useAsync(
    () => api.listUsers(departmentId),
    [api, departmentId],
  );
  const projects = useAsync(
    () => api.listProjects(departmentId),
    [api, departmentId],
  );

  const d = department.value;
  const crumbs = [
    { label: 'Departments', to: '/admin/departments' },
    { label: d?.name ?? 'Department' },
  ];

  if (!d) {
    return (
      <ConsolePage breadcrumbs={crumbs} title="Department">
        {department.error ? (
          <ErrorState
            title="Unable to load this department"
            error={department.error}
            onRetry={department.reload}
          />
        ) : (
          <LoadingState />
        )}
      </ConsolePage>
    );
  }

  const refreshUsers = () => {
    users.reload();
    department.reload();
  };

  return (
    <ConsolePage
      breadcrumbs={crumbs}
      title={d.name}
      description={`${d.shortCode} · ${
        d.ministry ? d.ministry.name : 'Not assigned to a ministry'
      }`}
      actions={
        <Button
          variant="outlined"
          color="primary"
          className={classes.button}
          startIcon={<EditOutlinedIcon />}
          onClick={() => setEditing(true)}
        >
          Edit department
        </Button>
      }
    >
      <StatGrid>
        <StatCard
          icon={<PeopleOutlineIcon />}
          label="Users"
          value={usage(d.userCount, d.userLimit)}
        />
        <StatCard
          icon={<FolderOpenOutlinedIcon />}
          label="Projects"
          value={usage(d.projectCount, d.projectLimit)}
        />
        <StatCard
          icon={<GridIcon />}
          label="Status"
          value={<StatusChip status={d.status} />}
        />
        <StatCard
          icon={<AccountBalanceOutlinedIcon />}
          label="Ministry"
          value={
            <span className={classes.ministry}>{d.ministry?.name ?? '–'}</span>
          }
        />
      </StatGrid>

      <SectionCard
        title={tab === 'users' ? 'Users' : 'Projects'}
        subtitle={
          tab === 'users'
            ? 'Everyone with access to this department. Owners and admins manage it.'
            : 'Projects of this department.'
        }
        action={
          tab === 'users' && (
            <Button
              variant="contained"
              color="primary"
              className={classes.button}
              startIcon={<AddIcon />}
              onClick={() => setAddingUser(true)}
            >
              Add user
            </Button>
          )
        }
      >
        <Tabs
          value={tab}
          onChange={(_e, value) => setTab(value)}
          className={classes.tabs}
          aria-label="Department sections"
        >
          <Tab
            value="users"
            label={`Users${users.value ? ` (${users.value.length})` : ''}`}
          />
          <Tab
            value="projects"
            label={`Projects${
              projects.value ? ` (${projects.value.length})` : ''
            }`}
          />
        </Tabs>
        {tab === 'users' ? (
          <UserList
            users={users.value ?? []}
            loading={users.loading}
            error={users.error}
            onRetry={users.reload}
            onRoleChange={async (user, role) => {
              try {
                await api.updateUserRole(d.id, user.userId, role);
                refreshUsers();
              } catch (error) {
                alertApi.post({
                  message: (error as Error).message,
                  severity: 'error',
                });
              }
            }}
            onRemove={setRemoving}
          />
        ) : (
          <ProjectList
            projects={projects.value ?? []}
            loading={projects.loading}
            error={projects.error}
            onRetry={projects.reload}
          />
        )}
      </SectionCard>

      <DepartmentForm
        open={editing}
        department={d}
        ministries={ministries.value ?? []}
        onClose={() => setEditing(false)}
        onUpdate={async (id, body) => {
          await api.updateDepartment(id, body);
          department.reload();
        }}
      />
      <UserForm
        open={addingUser}
        departmentName={d.name}
        defaultRole={d.admins.length ? 'DEVELOPER' : 'OWNER'}
        onClose={() => setAddingUser(false)}
        onSubmit={async body => {
          await api.addUser(d.id, body);
          refreshUsers();
        }}
      />
      <ConfirmDialog
        open={!!removing}
        title="Remove user?"
        body={
          <>
            <strong>{removing?.name}</strong> will lose access to {d.name} and
            its projects.
          </>
        }
        confirmLabel="Remove"
        onClose={() => setRemoving(undefined)}
        onConfirm={async () => {
          if (removing) {
            await api.removeUser(d.id, removing.userId);
            refreshUsers();
          }
        }}
      />
    </ConsolePage>
  );
}
