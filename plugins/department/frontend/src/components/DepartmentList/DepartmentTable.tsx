import { Link as RouterLink } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import Tooltip from '@material-ui/core/Tooltip';
import { Department } from '../../types';
import { formatDate, usage } from '../../utils/format';
import { tokens } from '../../utils/tokens';
import { Avatar, Column, DataTable, GridIcon, StatusChip } from '../Common';
import { DepartmentAction, DepartmentActions } from './DepartmentActions';

const useStyles = makeStyles({
  name: { display: 'flex', alignItems: 'center', gap: 10 },
  nameIcon: {
    width: 30,
    height: 30,
    flex: '0 0 30px',
    borderRadius: 6,
    border: `1px solid ${tokens.primaryBorder}`,
    color: tokens.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '& svg': { fontSize: 18 },
  },
  link: {
    color: tokens.primary,
    fontSize: 15,
    fontWeight: 500,
    textDecoration: 'none',
    maxWidth: 222,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    '&:hover': { textDecoration: 'underline' },
  },
  ministry: {
    display: 'block',
    maxWidth: 240,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: tokens.textBody,
  },
  muted: { color: tokens.textMuted },
  admin: { display: 'flex', alignItems: 'center', gap: 10 },
  adminName: { color: tokens.text, fontSize: 14 },
  more: {
    display: 'inline-block',
    padding: '0 5px',
    lineHeight: '18px',
    fontSize: 11,
    border: `1px solid ${tokens.inputBorder}`,
    borderRadius: tokens.radiusSm,
    color: tokens.text,
  },
});

function AdminsCell(props: { department: Department }) {
  const classes = useStyles();
  const [first, ...others] = props.department.admins;
  if (!first) {
    return <span className={classes.muted}>Not assigned</span>;
  }
  return (
    <span className={classes.admin}>
      <Avatar name={first.name} />
      <span className={classes.adminName}>{first.name}</span>
      {others.length > 0 && (
        <Tooltip title={others.map(a => a.name).join(', ')}>
          <span className={classes.more} aria-label={`${others.length} more admins`}>
            +{others.length}
          </span>
        </Tooltip>
      )}
    </span>
  );
}

/** The "All Departments" table of the design. */
export function DepartmentTable(props: {
  departments: Department[];
  loading: boolean;
  error?: Error;
  onRetry: () => void;
  onAction: (action: DepartmentAction, department: Department) => void;
}) {
  const classes = useStyles();
  const columns: Column<Department>[] = [
    {
      key: 'name',
      title: 'Departments',
      minWidth: 276,
      sticky: 'left',
      render: d => (
        <span className={classes.name}>
          <span className={classes.nameIcon} aria-hidden="true">
            <GridIcon />
          </span>
          <Tooltip title={d.name} enterDelay={600}>
            <RouterLink to={`/admin/departments/${d.id}`} className={classes.link}>
              {d.name}
            </RouterLink>
          </Tooltip>
        </span>
      ),
    },
    {
      key: 'ministry',
      title: 'Ministry',
      minWidth: 272,
      render: d =>
        d.ministry ? (
          <span className={classes.ministry} title={d.ministry.name}>
            {d.ministry.name}
          </span>
        ) : (
          <span className={classes.muted}>No ministry</span>
        ),
    },
    { key: 'admins', title: 'Admins', minWidth: 287, render: d => <AdminsCell department={d} /> },
    { key: 'users', title: 'Users', minWidth: 142, render: d => usage(d.userCount, d.userLimit) },
    {
      key: 'projects',
      title: 'Projects',
      minWidth: 142,
      render: d => usage(d.projectCount, d.projectLimit),
    },
    { key: 'status', title: 'Status', minWidth: 190, render: d => <StatusChip status={d.status} /> },
    { key: 'created', title: 'Created on', minWidth: 140, render: d => formatDate(d.createdAt) },
    {
      key: 'actions',
      title: <span className="sr-only" style={{ position: 'absolute', left: -9999 }}>Actions</span>,
      sticky: 'right',
      align: 'center',
      render: d => <DepartmentActions department={d} onAction={props.onAction} />,
    },
  ];

  return (
    <DataTable
      aria-label="Departments"
      columns={columns}
      rows={props.departments}
      rowKey={d => d.id}
      loading={props.loading}
      error={props.error}
      errorTitle="Unable to load departments"
      emptyTitle="No departments found"
      emptyBody="Try other filters, or add a department."
      onRetry={props.onRetry}
    />
  );
}
