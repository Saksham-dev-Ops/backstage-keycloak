import { Link as RouterLink } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import AccountBalanceOutlinedIcon from '@material-ui/icons/AccountBalanceOutlined';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import EditOutlinedIcon from '@material-ui/icons/EditOutlined';
import { Ministry } from '../../types';
import { formatDate } from '../../utils/format';
import { tokens } from '../../utils/tokens';
import { Column, DataTable } from '../Common';

const useStyles = makeStyles({
  name: { display: 'flex', alignItems: 'center', gap: 10, color: tokens.text, fontWeight: 500 },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 6,
    border: `1px solid ${tokens.primaryBorder}`,
    color: tokens.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '& svg': { fontSize: 18 },
  },
  link: { color: tokens.primary, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } },
  actions: { display: 'flex', gap: 4, justifyContent: 'center' },
});

export function MinistryList(props: {
  ministries: Ministry[];
  loading: boolean;
  error?: Error;
  onRetry: () => void;
  onEdit: (ministry: Ministry) => void;
  onDelete: (ministry: Ministry) => void;
}) {
  const classes = useStyles();
  const columns: Column<Ministry>[] = [
    {
      key: 'name',
      title: 'Ministry',
      minWidth: 320,
      sticky: 'left',
      render: m => (
        <span className={classes.name}>
          <span className={classes.icon} aria-hidden="true">
            <AccountBalanceOutlinedIcon />
          </span>
          {m.name}
        </span>
      ),
    },
    {
      key: 'departments',
      title: 'Departments',
      minWidth: 160,
      render: m => (
        <RouterLink
          className={classes.link}
          to={`/admin/departments?ministryId=${encodeURIComponent(m.id)}`}
        >
          {m.departmentCount}
        </RouterLink>
      ),
    },
    { key: 'description', title: 'Description', minWidth: 280, render: m => m.description ?? '–' },
    { key: 'created', title: 'Created on', minWidth: 140, render: m => formatDate(m.createdAt) },
    {
      key: 'actions',
      title: '',
      sticky: 'right',
      render: m => (
        <span className={classes.actions}>
          <Tooltip title="Edit">
            <IconButton size="small" aria-label={`Edit ${m.name}`} onClick={() => props.onEdit(m)}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" aria-label={`Delete ${m.name}`} onClick={() => props.onDelete(m)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </span>
      ),
    },
  ];
  return (
    <DataTable
      aria-label="Ministries"
      columns={columns}
      rows={props.ministries}
      rowKey={m => m.id}
      loading={props.loading}
      error={props.error}
      errorTitle="Unable to load ministries"
      emptyTitle="No ministries found"
      emptyBody="Add a ministry to group departments under it."
      onRetry={props.onRetry}
    />
  );
}
