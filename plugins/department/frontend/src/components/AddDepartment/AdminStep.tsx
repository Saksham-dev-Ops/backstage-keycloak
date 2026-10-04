import { useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Typography from '@material-ui/core/Typography';
import AddIcon from '@material-ui/icons/Add';
import PersonAddOutlinedIcon from '@material-ui/icons/PersonAddOutlined';
import { tokens } from '../../utils/tokens';
import { FieldInput, FormField } from '../Common';
import { AdminDialog } from './AdminDialog';
import { AdminTable } from './AdminTable';
import { useStepStyles } from './styles';
import { AdminDraft, LimitsErrors, WizardState } from './wizard';

const useStyles = makeStyles({
  checks: { display: 'flex', flexDirection: 'column', marginTop: -6 },
  checkLabel: { fontSize: 12, color: tokens.text },
  checkbox: {
    padding: 4,
    marginLeft: 5,
    '&.Mui-checked': { color: tokens.primary },
  },
  card: {
    border: `1px solid ${tokens.border}`,
    borderRadius: 10,
    overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    padding: '16px 20px',
    borderBottom: `1px solid ${tokens.border}`,
  },
  cardTitle: { fontSize: 13, fontWeight: 700, color: tokens.text },
  cardSubtitle: { fontSize: 12, color: tokens.textBody, marginTop: 4 },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 8,
    padding: '40px 20px 44px',
  },
  emptyIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: '#EAF0FC',
    color: tokens.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: { fontSize: 13, fontWeight: 700, color: tokens.text },
  emptyBody: { fontSize: 12, color: tokens.textBody, maxWidth: 380 },
  addButton: {
    marginTop: 6,
    height: 30,
    fontSize: 12,
    textTransform: 'none',
    borderRadius: 4,
    color: tokens.primary,
    borderColor: tokens.primary,
  },
  error: { fontSize: 12, color: tokens.danger },
});

/** Step 2: limits, admin permissions and the department's admins. */
export function AdminStep(props: {
  state: WizardState;
  errors: LimitsErrors;
  onChange: (changes: Partial<WizardState>) => void;
}) {
  const classes = useStyles();
  const step = useStepStyles();
  const { state, errors, onChange } = props;
  const [dialog, setDialog] = useState<{ open: boolean; admin?: AdminDraft }>({
    open: false,
  });
  const departmentName = state.name.trim() || 'this department';

  const save = (values: Omit<AdminDraft, 'key'>) => {
    const admins = dialog.admin
      ? state.admins.map(a =>
          a.key === dialog.admin!.key ? { ...a, ...values } : a,
        )
      : [
          ...state.admins,
          { ...values, key: `${Date.now()}-${state.admins.length}` },
        ];
    onChange({ admins });
    setDialog({ open: false });
  };

  const addButton = (
    <Button
      variant="outlined"
      className={classes.addButton}
      startIcon={<AddIcon fontSize="small" />}
      onClick={() => setDialog({ open: true })}
    >
      Add Admin
    </Button>
  );

  return (
    <>
      <section className={step.section} aria-labelledby="limits-section">
        <h2 id="limits-section" className={step.sectionTitle}>
          Limits for the Department admin
        </h2>
        <div className={step.twoColumns}>
          <FormField
            id="max-users"
            label="Maximum users"
            required
            info="How many people this department can have, admins included"
            error={errors.userLimit}
          >
            <FieldInput
              id="max-users"
              type="number"
              value={state.userLimit}
              onChange={e => onChange({ userLimit: e.target.value })}
              invalid={!!errors.userLimit}
              inputProps={{ min: 1 }}
            />
          </FormField>
          <FormField
            id="max-projects"
            label="Maximum projects"
            required
            info="How many projects this department can create"
            error={errors.projectLimit}
          >
            <FieldInput
              id="max-projects"
              type="number"
              value={state.projectLimit}
              onChange={e => onChange({ projectLimit: e.target.value })}
              invalid={!!errors.projectLimit}
              inputProps={{ min: 1 }}
            />
          </FormField>
        </div>
        <div className={classes.checks}>
          <FormControlLabel
            classes={{ label: classes.checkLabel }}
            control={
              <Checkbox
                size="small"
                className={classes.checkbox}
                checked={state.adminsCanApproveJoinRequests}
                onChange={e =>
                  onChange({ adminsCanApproveJoinRequests: e.target.checked })
                }
              />
            }
            label="Department admins can approve join requests"
          />
          <FormControlLabel
            classes={{ label: classes.checkLabel }}
            control={
              <Checkbox
                size="small"
                className={classes.checkbox}
                checked={state.adminsCanCreateCustomRoles}
                onChange={e =>
                  onChange({ adminsCanCreateCustomRoles: e.target.checked })
                }
              />
            }
            label="Department admins can create custom roles"
          />
        </div>
      </section>

      <section className={classes.card} aria-labelledby="admins-section">
        <div className={classes.cardHeader}>
          <div>
            <Typography
              id="admins-section"
              component="h2"
              className={classes.cardTitle}
            >
              Add the Department admin
            </Typography>
            <Typography className={classes.cardSubtitle}>
              This person will manage roles, groups, people and projects for{' '}
              {departmentName}.
            </Typography>
          </div>
          {state.admins.length > 0 && addButton}
        </div>
        {state.admins.length === 0 ? (
          <div className={classes.empty}>
            <span className={classes.emptyIcon} aria-hidden="true">
              <PersonAddOutlinedIcon fontSize="small" />
            </span>
            <Typography className={classes.emptyTitle}>
              No admins added yet
            </Typography>
            <Typography className={classes.emptyBody}>
              Add at least one Department admin to continue. They will manage
              roles, groups, people and projects for {departmentName}.
            </Typography>
            {addButton}
          </div>
        ) : (
          <AdminTable
            admins={state.admins}
            onEdit={admin => setDialog({ open: true, admin })}
            onRemove={admin =>
              onChange({
                admins: state.admins.filter(a => a.key !== admin.key),
              })
            }
          />
        )}
      </section>
      {errors.admins && state.admins.length > 0 && (
        <span className={classes.error} role="alert">
          {errors.admins}
        </span>
      )}

      <AdminDialog
        open={dialog.open}
        admin={dialog.admin}
        departmentName={departmentName}
        others={state.admins.filter(a => a.key !== dialog.admin?.key)}
        onClose={() => setDialog({ open: false })}
        onSave={save}
      />
    </>
  );
}
