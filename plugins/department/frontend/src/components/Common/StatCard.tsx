import { ReactNode } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import { tokens } from '../../utils/tokens';

const useStyles = makeStyles({
  card: {
    border: `1px solid ${tokens.border}`,
    borderRadius: 10,
    background: tokens.surface,
    padding: '20px 20px 18px',
    minHeight: 130,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: 16,
  },
  head: { display: 'flex', alignItems: 'center', gap: 12 },
  icon: {
    width: 42,
    height: 42,
    flex: '0 0 42px',
    borderRadius: 8,
    border: `1px solid ${tokens.primaryBorder}`,
    background: tokens.primarySoft,
    color: tokens.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '& svg': { fontSize: 22 },
  },
  label: { fontSize: 15, fontWeight: 600, color: tokens.text, lineHeight: 1.3 },
  value: { fontSize: 28, fontWeight: 700, color: tokens.text, lineHeight: 1 },
});

/** A stat tile of the design: icon, label and a large number. */
export function StatCard(props: { icon: ReactNode; label: string; value: ReactNode }) {
  const classes = useStyles();
  return (
    <div className={classes.card}>
      <div className={classes.head}>
        <span className={classes.icon} aria-hidden="true">
          {props.icon}
        </span>
        <Typography className={classes.label}>{props.label}</Typography>
      </div>
      <Typography className={classes.value}>{props.value}</Typography>
    </div>
  );
}

const useGridStyles = makeStyles(theme => ({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 16,
    marginBottom: 24,
    [theme.breakpoints.down('sm')]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
    [theme.breakpoints.down('xs')]: { gridTemplateColumns: 'minmax(0, 1fr)' },
  },
}));

export function StatGrid(props: { children: ReactNode }) {
  const classes = useGridStyles();
  return <div className={classes.grid}>{props.children}</div>;
}
