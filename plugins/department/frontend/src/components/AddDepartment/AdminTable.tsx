import { makeStyles } from '@material-ui/core/styles';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import EditOutlinedIcon from '@material-ui/icons/EditOutlined';
import { tokens } from '../../utils/tokens';
import { Avatar, Column, DataTable } from '../Common';
import { AdminDraft, formatMobile } from './wizard';

export const ADMIN_GROUP = 'Admins';

const useStyles = makeStyles({
  name: { display: 'flex', alignItems: 'center', gap: 10, color: tokens.text },
  actions: { display: 'flex', gap: 2, justifyContent: 'center' },
});

/** Admins entered in the form, on the admin step (editable) and on review. */
export function AdminTable(props: {
  admins: AdminDraft[];
  onEdit?: (admin: AdminDraft) => void;
  onRemove?: (admin: AdminDraft) => void;
}) {
  const classes = useStyles();
  const columns: Column<AdminDraft>[] = [
    {
      key: 'name',
      title: 'Admin name',
      minWidth: 180,
      render: a => (
        <span className={classes.name}>
          <Avatar name={a.name} size={26} />
          {a.name}
        </span>
      ),
    },
    { key: 'email', title: 'Email', minWidth: 200, render: a => a.email },
    {
      key: 'designation',
      title: 'Designation',
      minWidth: 150,
      render: a => a.designation,
    },
    {
      key: 'mobile',
      title: 'Mobile',
      minWidth: 140,
      render: a => formatMobile(a.mobile),
    },
    { key: 'group', title: 'Group', minWidth: 100, render: () => ADMIN_GROUP },
  ];
  if (props.onEdit || props.onRemove) {
    columns.push({
      key: 'actions',
      title: '',
      align: 'center',
      render: a => (
        <span className={classes.actions}>
          {props.onEdit && (
            <Tooltip title="Edit">
              <IconButton
                size="small"
                aria-label={`Edit ${a.name}`}
                onClick={() => props.onEdit?.(a)}
              >
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {props.onRemove && (
            <Tooltip title="Remove">
              <IconButton
                size="small"
                aria-label={`Remove ${a.name}`}
                onClick={() => props.onRemove?.(a)}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </span>
      ),
    });
  }
  return (
    <DataTable
      aria-label="Department admins"
      dense
      columns={columns}
      rows={props.admins}
      rowKey={a => a.key}
      errorTitle=""
      emptyTitle="No admins added yet"
    />
  );
}
