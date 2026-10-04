import { makeStyles } from '@material-ui/core/styles';
import { AuditLogEntry } from '../../types';
import { formatDateTime, humanize } from '../../utils/format';
import { tokens } from '../../utils/tokens';
import { Column, DataTable } from '../Common';

const useStyles = makeStyles({
  details: {
    color: tokens.textMuted,
    fontSize: 13,
    maxWidth: 420,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  action: { color: tokens.text, fontWeight: 500 },
});

function describe(entry: AuditLogEntry) {
  if (!entry.metadata) return '–';
  return Object.entries(entry.metadata)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');
}

export function AuditLogTable(props: {
  entries: AuditLogEntry[];
  loading: boolean;
  error?: Error;
  onRetry: () => void;
}) {
  const classes = useStyles();
  const columns: Column<AuditLogEntry>[] = [
    { key: 'time', title: 'Time', minWidth: 190, sticky: 'left', render: e => formatDateTime(e.createdAt) },
    {
      key: 'action',
      title: 'Action',
      minWidth: 220,
      render: e => <span className={classes.action}>{humanize(e.action)}</span>,
    },
    { key: 'actor', title: 'By', minWidth: 220, render: e => e.actorEmail ?? '–' },
    { key: 'resource', title: 'Resource', minWidth: 130, render: e => humanize(e.resourceType) },
    {
      key: 'details',
      title: 'Details',
      minWidth: 320,
      render: e => (
        <span className={classes.details} title={describe(e)}>
          {describe(e)}
        </span>
      ),
    },
  ];
  return (
    <DataTable
      aria-label="Audit log"
      columns={columns}
      rows={props.entries}
      rowKey={e => e.id}
      loading={props.loading}
      error={props.error}
      errorTitle="Unable to load the audit log"
      emptyTitle="No activity yet"
      onRetry={props.onRetry}
    />
  );
}
