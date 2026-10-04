import { makeStyles } from '@material-ui/core/styles';
import { DepartmentStatus } from '../../types';
import { STATUS_LABELS } from '../../utils/format';
import { tokens } from '../../utils/tokens';

const COLORS: Record<DepartmentStatus, { fg: string; bg: string }> = {
  active: { fg: tokens.success, bg: tokens.successSoft },
  invite_pending: { fg: tokens.warning, bg: tokens.warningSoft },
  no_admin: { fg: tokens.danger, bg: tokens.dangerSoft },
  suspended: { fg: tokens.textMuted, bg: tokens.neutralSoft },
};

const useStyles = makeStyles({
  chip: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: tokens.radiusSm,
    fontSize: 12,
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
});

export function StatusChip(props: { status: DepartmentStatus }) {
  const classes = useStyles();
  const { fg, bg } = COLORS[props.status];
  return (
    <span className={classes.chip} style={{ color: fg, background: bg }}>
      {STATUS_LABELS[props.status]}
    </span>
  );
}
