import { makeStyles } from '@material-ui/core/styles';
import Checkbox from '@material-ui/core/Checkbox';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import { Capability } from '../../types';
import { tokens } from '../../utils/tokens';
import { ToolChips } from './ToolChip';

const useStyles = makeStyles(theme => ({
  card: {
    border: `1px solid ${tokens.border}`,
    borderRadius: tokens.radius,
    padding: '14px 16px 16px',
    background: tokens.surface,
  },
  head: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    cursor: 'pointer',
  },
  checkbox: { padding: 0, marginTop: 1, color: tokens.inputBorder },
  checked: { color: `${tokens.primary} !important` },
  title: { fontSize: 13, fontWeight: 600, color: tokens.text },
  required: { color: tokens.danger, marginLeft: 3 },
  description: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    color: tokens.textMuted,
    marginTop: 2,
  },
  infoIcon: { fontSize: 12 },
  rows: { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 },
  row: {
    display: 'grid',
    gridTemplateColumns: '90px minmax(0, 1fr)',
    alignItems: 'center',
    gap: 12,
    [theme.breakpoints.down('xs')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
      gap: 6,
    },
  },
  rowLabel: { fontSize: 11, color: tokens.textBody },
  disabled: { opacity: 0.55 },
}));

/** An area the department can use, with its included and upcoming tools. */
export function CapabilityCard(props: {
  capability: Capability;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const classes = useStyles();
  const { capability } = props;
  const id = `capability-${capability.id}`;
  return (
    <div className={classes.card}>
      <label className={classes.head} htmlFor={id}>
        <Checkbox
          id={id}
          size="small"
          checked={props.checked}
          onChange={e => props.onChange(e.target.checked)}
          className={classes.checkbox}
          classes={{ checked: classes.checked }}
          inputProps={{ 'aria-describedby': `${id}-description` }}
        />
        <span>
          <span className={classes.title}>
            {capability.title}
            <span className={classes.required} aria-hidden="true">
              *
            </span>
          </span>
          <span className={classes.description} id={`${id}-description`}>
            <InfoOutlinedIcon className={classes.infoIcon} aria-hidden="true" />
            {capability.description}
          </span>
        </span>
      </label>
      <div
        className={`${classes.rows} ${props.checked ? '' : classes.disabled}`}
      >
        <div className={classes.row}>
          <span className={classes.rowLabel}>Always Included</span>
          <ToolChips tools={capability.included} variant="included" />
        </div>
        {capability.comingSoon.length > 0 && (
          <div className={classes.row}>
            <span className={classes.rowLabel}>Coming Soon</span>
            <ToolChips tools={capability.comingSoon} variant="soon" />
          </div>
        )}
      </div>
    </div>
  );
}
