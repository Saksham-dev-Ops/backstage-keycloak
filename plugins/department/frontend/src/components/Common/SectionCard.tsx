import { ReactNode } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import { tokens } from '../../utils/tokens';

const useStyles = makeStyles({
  card: {
    border: `1px solid ${tokens.border}`,
    borderRadius: 10,
    background: tokens.surface,
    overflow: 'hidden',
  },
  header: { padding: '22px 20px 20px' },
  titleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 20, fontWeight: 600, color: tokens.text, lineHeight: 1.3 },
  subtitle: { fontSize: 13, color: tokens.textBody, marginTop: 4 },
  toolbar: { marginTop: 18 },
});

/** The bordered card holding a list: title, subtitle, filters, then the table. */
export function SectionCard(props: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  const classes = useStyles();
  return (
    <section className={classes.card} aria-label={props.title}>
      <div className={classes.header}>
        <div className={classes.titleRow}>
          <Typography component="h2" className={classes.title}>
            {props.title}
          </Typography>
          {props.action}
        </div>
        {props.subtitle && <Typography className={classes.subtitle}>{props.subtitle}</Typography>}
        {props.toolbar && <div className={classes.toolbar}>{props.toolbar}</div>}
      </div>
      {props.children}
    </section>
  );
}
