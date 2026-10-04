import { ReactNode } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { tokens } from '../../utils/tokens';
import { EmptyState, ErrorState, LoadingState } from './States';

export type Column<T> = {
  key: string;
  title: ReactNode;
  render: (row: T) => ReactNode;
  /** Minimum width in px; together they make the table scroll horizontally */
  minWidth?: number;
  /** Stays visible while scrolling horizontally */
  sticky?: 'left' | 'right';
  align?: 'left' | 'right' | 'center';
};

const useStyles = makeStyles({
  scroller: {
    overflowX: 'auto',
    borderTop: `1px solid ${tokens.border}`,
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    fontSize: 14,
    color: tokens.textBody,
  },
  th: {
    background: tokens.surfaceMuted,
    fontSize: 13,
    fontWeight: 600,
    color: tokens.textBody,
    textAlign: 'left',
    padding: '12px 16px',
    height: 40,
    borderBottom: `1px solid ${tokens.border}`,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '0 16px',
    height: 70,
    borderBottom: `1px solid ${tokens.border}`,
    background: tokens.surface,
    whiteSpace: 'nowrap',
  },
  row: {
    '&:last-child td': { borderBottom: 'none' },
    '&:hover td': { background: '#FAFBFC' },
  },
  stickyLeft: {
    position: 'sticky',
    left: 0,
    zIndex: 1,
    borderRight: `1px solid ${tokens.border}`,
  },
  stickyRight: {
    position: 'sticky',
    right: 0,
    zIndex: 1,
    borderLeft: `1px solid ${tokens.border}`,
    width: 64,
  },
  state: { padding: 0, borderBottom: 'none' },
  dense: { height: 52, fontSize: 13 },
});

/**
 * The table of the design. Loading, error and empty states are rendered in
 * place of the rows, so the card layout stays the same.
 */
export function DataTable<T>(props: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: Error;
  errorTitle: string;
  emptyTitle: string;
  emptyBody?: string;
  onRetry?: () => void;
  /** Shorter rows, e.g. inside a review summary */
  dense?: boolean;
  'aria-label': string;
}) {
  const classes = useStyles();
  const stickyClasses = {
    left: classes.stickyLeft,
    right: classes.stickyRight,
  };
  const stickyClass = (column: Column<T>) =>
    column.sticky ? stickyClasses[column.sticky] : '';

  let state: ReactNode;
  if (props.error) {
    state = (
      <ErrorState
        title={props.errorTitle}
        error={props.error}
        onRetry={props.onRetry}
      />
    );
  } else if (props.loading && props.rows.length === 0) {
    state = <LoadingState />;
  } else if (props.rows.length === 0) {
    state = <EmptyState title={props.emptyTitle} body={props.emptyBody} />;
  }

  return (
    <div className={classes.scroller}>
      <table
        className={classes.table}
        aria-label={props['aria-label']}
        aria-busy={props.loading}
      >
        <thead>
          <tr>
            {props.columns.map(column => (
              <th
                key={column.key}
                scope="col"
                className={`${classes.th} ${stickyClass(column)}`}
                style={{ minWidth: column.minWidth, textAlign: column.align }}
              >
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {state ? (
            <tr>
              <td colSpan={props.columns.length} className={classes.state}>
                {state}
              </td>
            </tr>
          ) : (
            props.rows.map(row => (
              <tr key={props.rowKey(row)} className={classes.row}>
                {props.columns.map(column => (
                  <td
                    key={column.key}
                    className={`${classes.td} ${
                      props.dense ? classes.dense : ''
                    } ${stickyClass(column)}`}
                    style={{ textAlign: column.align }}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
