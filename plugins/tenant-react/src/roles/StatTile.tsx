import { ReactNode } from 'react';
import { makeStyles } from '@material-ui/core';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';

const useStyles = makeStyles(theme => ({
  tile: {
    padding: theme.spacing(2.5),
    borderLeft: `4px solid ${theme.palette.primary.main}`,
    height: '100%',
  },
  value: { fontSize: 36, fontWeight: 700, lineHeight: 1.1 },
}));

/** A big number with a label, used on the dashboards of every role. */
export function StatTile(props: { label: string; value: ReactNode }) {
  const classes = useStyles();
  return (
    <Paper className={classes.tile}>
      <Typography className={classes.value}>{props.value}</Typography>
      <Typography color="textSecondary">{props.label}</Typography>
    </Paper>
  );
}
