import { ReactNode } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import { tokens } from '../../utils/tokens';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 24,
    [theme.breakpoints.down('xs')]: { flexDirection: 'column' },
  },
  title: {
    fontSize: 26,
    fontWeight: 700,
    color: tokens.text,
    lineHeight: 1.25,
  },
  description: { fontSize: 15, color: tokens.textBody, marginTop: 6 },
  actions: { display: 'flex', gap: 8, flex: '0 0 auto', paddingTop: 2 },
}));

export function PageHeader(props: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  const classes = useStyles();
  return (
    <header className={classes.root}>
      <div>
        <Typography component="h1" className={classes.title}>
          {props.title}
        </Typography>
        {props.description && (
          <Typography className={classes.description}>
            {props.description}
          </Typography>
        )}
      </div>
      {props.actions && <div className={classes.actions}>{props.actions}</div>}
    </header>
  );
}
