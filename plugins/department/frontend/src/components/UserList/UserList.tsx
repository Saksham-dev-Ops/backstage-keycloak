import { makeStyles } from '@material-ui/core/styles';
import IconButton from '@material-ui/core/IconButton';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import Tooltip from '@material-ui/core/Tooltip';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import { DepartmentUser, TENANT_ROLES, TenantRole } from '../../types';
import { formatDate, ROLE_LABELS } from '../../utils/format';
import { tokens } from '../../utils/tokens';
import { Avatar, Column, DataTable } from '../Common';

const useStyles = makeStyles({
  person: { display: 'flex', alignItems: 'center', gap: 10 },
  name: { color: tokens.text, fontWeight: 500 },
  email: { color: tokens.textMuted, fontSize: 13 },
  role: {
    height: 32,
    minWidth: 130,
    fontSize: 13,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.inputBorder },
  },
  pending: { color: tokens.warning },
  designation: { color: tokens.textMuted, fontSize: 12 },
});

/** Users of a department, with inline role changes for admins. */
export function UserList(props: {
  users: DepartmentUser[];
  loading: boolean;
  error?: Error;
  onRetry: () => void;
  onRoleChange?: (user: DepartmentUser, role: TenantRole) => void;
  onRemove?: (user: DepartmentUser) => void;
}) {
  const classes = useStyles();
  const columns: Column<DepartmentUser>[] = [
    {
      key: 'name',
      title: 'User',
      minWidth: 300,
      sticky: 'left',
      render: u => (
        <span className={classes.person}>
          <Avatar name={u.name} />
          <span>
            <div className={classes.name}>{u.name}</div>
            <div className={classes.email}>
              {u.email}
              {u.designation && (
                <span className={classes.designation}> · {u.designation}</span>
              )}
            </div>
          </span>
        </span>
      ),
    },
    {
      key: 'role',
      title: 'Role',
      minWidth: 170,
      render: u =>
        props.onRoleChange ? (
          <Select
            variant="outlined"
            value={u.role}
            className={classes.role}
            onChange={e =>
              props.onRoleChange?.(u, e.target.value as TenantRole)
            }
            inputProps={{ 'aria-label': `Role of ${u.name}` }}
          >
            {TENANT_ROLES.map(role => (
              <MenuItem key={role} value={role}>
                {ROLE_LABELS[role]}
              </MenuItem>
            ))}
          </Select>
        ) : (
          ROLE_LABELS[u.role]
        ),
    },
    {
      key: 'lastSignIn',
      title: 'Last sign-in',
      minWidth: 260,
      render: u => {
        if (u.lastSignInAt) {
          return formatDate(u.lastSignInAt);
        }
        return <span className={classes.pending}>Not signed in yet</span>;
      },
    },
    {
      key: 'added',
      title: 'Added on',
      minWidth: 140,
      render: u => formatDate(u.createdAt),
    },
  ];
  if (props.onRemove) {
    columns.push({
      key: 'actions',
      title: '',
      sticky: 'right',
      align: 'center',
      render: u => (
        <Tooltip title="Remove from department">
          <IconButton
            size="small"
            aria-label={`Remove ${u.name}`}
            onClick={() => props.onRemove?.(u)}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    });
  }

  return (
    <DataTable
      aria-label="Users"
      columns={columns}
      rows={props.users}
      rowKey={u => u.userId}
      loading={props.loading}
      error={props.error}
      errorTitle="Unable to load users"
      emptyTitle="No users found"
      onRetry={props.onRetry}
    />
  );
}
