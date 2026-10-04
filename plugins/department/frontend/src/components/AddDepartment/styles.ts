import { makeStyles } from '@material-ui/core/styles';
import { tokens } from '../../utils/tokens';

/** Shared layout of the onboarding steps. */
export const useStepStyles = makeStyles(theme => ({
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: tokens.text,
    margin: 0,
  },
  sectionSubtitle: { fontSize: 12, color: tokens.textBody, marginTop: -10 },
  twoColumns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 16,
    [theme.breakpoints.down('xs')]: { gridTemplateColumns: 'minmax(0, 1fr)' },
  },
  select: {
    '& .MuiSelect-select': {
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      height: 38,
    },
    '& .MuiSelect-icon': { color: tokens.textBody },
  },
  placeholder: { color: tokens.textMuted },
  sectionError: { fontSize: 12, color: tokens.danger },
}));
