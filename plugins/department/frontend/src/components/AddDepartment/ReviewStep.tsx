import { ReactNode } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import { Capability, Ministry } from '../../types';
import { tokens } from '../../utils/tokens';
import { AdminTable } from './AdminTable';
import { ToolChips } from './ToolChip';
import { comingSoonSummary, WizardState } from './wizard';

const useStyles = makeStyles(theme => ({
  sections: { display: 'flex', flexDirection: 'column', gap: 16 },
  card: {
    border: `1px solid ${tokens.border}`,
    borderRadius: 8,
    background: tokens.surface,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px 12px',
    margin: '0 12px',
    borderBottom: `1px solid ${tokens.border}`,
  },
  title: { fontSize: 13, fontWeight: 700, color: tokens.text },
  edit: {
    fontSize: 12,
    color: tokens.primary,
    textTransform: 'none',
    minWidth: 0,
    padding: '2px 6px',
  },
  body: {
    padding: '14px 28px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '130px minmax(0, 1fr)',
    alignItems: 'center',
    gap: 12,
    fontSize: 12,
    [theme.breakpoints.down('xs')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
      gap: 4,
    },
  },
  label: { color: tokens.textBody },
  value: { color: tokens.text, fontWeight: 600, overflowWrap: 'anywhere' },
  note: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    color: tokens.textMuted,
  },
  noteIcon: { fontSize: 13 },
  adminNote: {
    fontSize: 12,
    color: tokens.textBody,
    padding: '14px 28px 12px',
  },
  table: { margin: '0 12px 12px' },
}));

function ReviewSection(props: {
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  const classes = useStyles();
  return (
    <section className={classes.card} aria-label={props.title}>
      <div className={classes.header}>
        <Typography component="h2" className={classes.title}>
          {props.title}
        </Typography>
        <Button
          className={classes.edit}
          onClick={props.onEdit}
          aria-label={`Edit ${props.title}`}
        >
          Edit
        </Button>
      </div>
      {props.children}
    </section>
  );
}

function Row(props: { label: string; children: ReactNode }) {
  const classes = useStyles();
  return (
    <div className={classes.row}>
      <span className={classes.label}>{props.label}</span>
      <span className={classes.value}>{props.children}</span>
    </div>
  );
}

/** Step 3: everything entered, with Edit links back to each step. */
export function ReviewStep(props: {
  state: WizardState;
  ministries: Ministry[];
  catalog: Capability[];
  onEdit: (step: number) => void;
}) {
  const classes = useStyles();
  const { state } = props;
  const enabled = props.catalog.filter(c => state.capabilities.includes(c.id));
  const disabled = props.catalog.filter(
    c => !state.capabilities.includes(c.id),
  );
  const comingSoon = comingSoonSummary(props.catalog, state.capabilities);

  return (
    <div className={classes.sections}>
      <ReviewSection title="Department details" onEdit={() => props.onEdit(0)}>
        <div className={classes.body}>
          <Row label="Ministry">
            {props.ministries.find(m => m.id === state.ministryId)?.name ?? '–'}
          </Row>
          <Row label="Department name">{state.name.trim()}</Row>
          <Row label="Short code">{state.shortCode.trim().toUpperCase()}</Row>
        </div>
      </ReviewSection>

      <ReviewSection
        title="What this department can use"
        onEdit={() => props.onEdit(0)}
      >
        <div className={classes.body}>
          {enabled.map(c => (
            <div key={c.id} className={classes.row}>
              <span className={classes.label}>{c.title}</span>
              <ToolChips tools={c.included} variant="review" />
            </div>
          ))}
          {disabled.length > 0 && (
            <Row label="Not enabled">
              {disabled.map(c => c.title).join(', ')}
            </Row>
          )}
          {comingSoon && (
            <span className={classes.note}>
              <InfoOutlinedIcon
                className={classes.noteIcon}
                aria-hidden="true"
              />
              Not included yet (Coming Soon): {comingSoon}.
            </span>
          )}
        </div>
      </ReviewSection>

      <ReviewSection
        title="Limits for the Department admin"
        onEdit={() => props.onEdit(1)}
      >
        <div className={classes.body}>
          <Row label="Maximum users">{state.userLimit}</Row>
          <Row label="Maximum projects">{state.projectLimit}</Row>
        </div>
      </ReviewSection>

      <ReviewSection
        title={`Department admins (${state.admins.length})`}
        onEdit={() => props.onEdit(1)}
      >
        <Typography className={classes.adminNote}>
          Each admin signs in with Keycloak using their official email once
          you add the department.
        </Typography>
        <div className={classes.table}>
          <AdminTable admins={state.admins} />
        </div>
      </ReviewSection>
    </div>
  );
}
