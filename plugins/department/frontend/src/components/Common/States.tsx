import { ReactNode } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import InboxOutlinedIcon from '@material-ui/icons/InboxOutlined';
import { tokens } from '../../utils/tokens';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '48px 16px',
    textAlign: 'center',
    color: tokens.textMuted,
  },
  title: { fontSize: 15, fontWeight: 600, color: tokens.text },
  body: { fontSize: 13, maxWidth: 420 },
  errorIcon: { color: tokens.danger, fontSize: 32 },
  emptyIcon: { color: tokens.primaryBorder, fontSize: 36 },
});

export function LoadingState(props: { label?: string }) {
  const classes = useStyles();
  return (
    <div className={classes.root} role="status" aria-live="polite">
      <CircularProgress size={28} />
      <Typography className={classes.body}>{props.label ?? 'Loading...'}</Typography>
    </div>
  );
}

export function EmptyState(props: { title: string; body?: string; action?: ReactNode }) {
  const classes = useStyles();
  return (
    <div className={classes.root}>
      <InboxOutlinedIcon className={classes.emptyIcon} />
      <Typography className={classes.title}>{props.title}</Typography>
      {props.body && <Typography className={classes.body}>{props.body}</Typography>}
      {props.action}
    </div>
  );
}

export function ErrorState(props: { title: string; error?: Error; onRetry?: () => void }) {
  const classes = useStyles();
  return (
    <div className={classes.root} role="alert">
      <ErrorOutlineIcon className={classes.errorIcon} />
      <Typography className={classes.title}>{props.title}</Typography>
      {props.error && <Typography className={classes.body}>{props.error.message}</Typography>}
      {props.onRetry && (
        <Button size="small" color="primary" variant="outlined" onClick={props.onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
