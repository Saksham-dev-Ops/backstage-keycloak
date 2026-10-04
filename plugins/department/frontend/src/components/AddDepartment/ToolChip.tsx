import { makeStyles } from '@material-ui/core/styles';
import { tokens } from '../../utils/tokens';

const useStyles = makeStyles({
  chip: {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: tokens.radiusSm,
    fontSize: 11,
    lineHeight: '16px',
    whiteSpace: 'nowrap',
  },
  included: { background: '#D5F5EC', color: '#0B5E4E' },
  soon: { background: '#E7E8EB', color: tokens.textBody },
  review: { background: '#E6EEFC', color: tokens.primary },
  list: { display: 'flex', flexWrap: 'wrap', gap: 6 },
});

/** A tool name: mint when included, grey when coming soon, blue on review. */
export function ToolChip(props: {
  label: string;
  variant: 'included' | 'soon' | 'review';
}) {
  const classes = useStyles();
  return (
    <span className={`${classes.chip} ${classes[props.variant]}`}>
      {props.label}
    </span>
  );
}

export function ToolChips(props: {
  tools: string[];
  variant: 'included' | 'soon' | 'review';
}) {
  const classes = useStyles();
  return (
    <span className={classes.list}>
      {props.tools.map(tool => (
        <ToolChip key={tool} label={tool} variant={props.variant} />
      ))}
    </span>
  );
}
