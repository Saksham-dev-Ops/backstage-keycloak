import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';
import { makeStyles } from '@material-ui/core/styles';
import { departmentApiRef } from '../api/DepartmentApi';
import {
  AdminStep,
  DetailsStep,
  INITIAL_STATE,
  InviteLinksDialog,
  isDirty,
  ReviewStep,
  STEPS,
  Stepper,
  toRequest,
  validateDetails,
  validateLimits,
  WizardFooter,
  WizardState,
} from '../components/AddDepartment';
import {
  DetailsErrors,
  LimitsErrors,
} from '../components/AddDepartment/wizard';
import { ConfirmDialog, GridIcon } from '../components/Common';
import { ConsolePage } from '../components/Layout';
import { useAsync } from '../hooks';
import { CreateDepartmentResponse, DepartmentApiError } from '../types';
import { tokens } from '../utils/tokens';
import { hasErrors } from '../utils/validation';

const useStyles = makeStyles({
  wizard: { maxWidth: 1100 },
  error: {
    background: tokens.dangerSoft,
    color: tokens.danger,
    borderRadius: tokens.radiusSm,
    padding: '10px 12px',
    fontSize: 13,
    marginTop: 16,
  },
});

const DESCRIPTIONS = [
  'A Department is a division or agency under a ministry.',
  'A Department is a division or agency under a ministry.',
  'Check everything below before you add the department. Use Edit to change a section.',
];

function scrollToTop() {
  try {
    window.scrollTo({ top: 0 });
  } catch {
    // Not available in every environment
  }
}

/**
 * Add Department, in three steps: details and capabilities, limits and
 * admins, then review. Nothing is saved until "Add Department".
 */
export function AddDepartmentPage() {
  const classes = useStyles();
  const api = useApi(departmentApiRef);
  const alertApi = useApi(alertApiRef);
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [detailsErrors, setDetailsErrors] = useState<DetailsErrors>({});
  const [limitsErrors, setLimitsErrors] = useState<LimitsErrors>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [created, setCreated] = useState<CreateDepartmentResponse>();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const validated = useRef({ details: false, limits: false });

  const ministries = useAsync(() => api.listMinistries(), [api]);
  const catalog = useAsync(() => api.listCapabilities(), [api]);

  // Every area starts enabled, as in the design
  const catalogValue = catalog.value;
  useEffect(() => {
    if (catalogValue) {
      setState(s =>
        s.capabilities.length
          ? s
          : { ...s, capabilities: catalogValue.map(c => c.id) },
      );
    }
  }, [catalogValue]);

  const update = (changes: Partial<WizardState>) => {
    const next = { ...state, ...changes };
    setState(next);
    // Once a step was submitted, errors follow the input
    if (validated.current.details) setDetailsErrors(validateDetails(next));
    if (validated.current.limits) setLimitsErrors(validateLimits(next));
  };

  const goTo = (index: number) => {
    setSubmitError(undefined);
    setStep(index);
    scrollToTop();
  };

  const continueFromDetails = async () => {
    validated.current.details = true;
    const errors = validateDetails(state);
    setDetailsErrors(errors);
    if (hasErrors(errors)) return;
    setBusy(true);
    try {
      if (!(await api.isShortCodeAvailable(state.shortCode.trim()))) {
        setDetailsErrors({
          shortCode: 'This short code is already used by another department',
        });
        return;
      }
      goTo(1);
    } catch (error) {
      setSubmitError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const continueFromAdmins = () => {
    validated.current.limits = true;
    const errors = validateLimits(state);
    setLimitsErrors(errors);
    if (!hasErrors(errors)) goTo(2);
  };

  const submit = async () => {
    setBusy(true);
    setSubmitError(undefined);
    try {
      setCreated(await api.createDepartment(toRequest(state)));
    } catch (error) {
      if (
        error instanceof DepartmentApiError &&
        error.code === 'SHORT_CODE_TAKEN'
      ) {
        setDetailsErrors({ shortCode: error.message });
        goTo(0);
      } else {
        setSubmitError((error as Error).message);
      }
    } finally {
      setBusy(false);
    }
  };

  const finish = () => {
    if (!created) return;
    alertApi.post({
      message: `${created.department.name} was added`,
      severity: 'success',
      display: 'transient',
    });
    navigate(`/admin/departments/${created.department.id}`);
  };

  const footers = [
    {
      label: 'Continue',
      onPrimary: continueFromDetails,
      disabled: !catalog.value,
    },
    {
      label: 'Review Changes',
      onPrimary: continueFromAdmins,
      disabled: state.admins.length === 0,
    },
    { label: 'Add Department', onPrimary: submit, disabled: false },
  ];
  const footer = footers[step];

  return (
    <ConsolePage
      breadcrumbVariant="section"
      breadcrumbs={[
        { label: 'Departments', to: '/admin/departments', icon: <GridIcon /> },
        { label: 'Add Department' },
      ]}
      title="Add Department"
      description={DESCRIPTIONS[step]}
    >
      <div className={classes.wizard}>
        <Stepper steps={STEPS} active={step} onSelect={goTo} />

        {step === 0 && (
          <DetailsStep
            state={state}
            errors={detailsErrors}
            ministries={ministries.value ?? []}
            catalog={catalog}
            onChange={update}
          />
        )}
        {step === 1 && (
          <AdminStep state={state} errors={limitsErrors} onChange={update} />
        )}
        {step === 2 && (
          <ReviewStep
            state={state}
            ministries={ministries.value ?? []}
            catalog={catalog.value ?? []}
            onEdit={goTo}
          />
        )}

        {submitError && (
          <div className={classes.error} role="alert">
            {submitError}
          </div>
        )}

        <WizardFooter
          primaryLabel={footer.label}
          primaryDisabled={footer.disabled}
          busy={busy}
          backDisabled={step === 0}
          onCancel={() =>
            isDirty(state)
              ? setConfirmCancel(true)
              : navigate('/admin/departments')
          }
          onBack={() => goTo(step - 1)}
          onPrimary={footer.onPrimary}
        />
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title="Discard this department?"
        body="Everything you entered will be lost."
        confirmLabel="Discard"
        onClose={() => setConfirmCancel(false)}
        onConfirm={async () => navigate('/admin/departments')}
      />
      <InviteLinksDialog
        open={!!created}
        title={`${created?.department.name ?? 'Department'} was added`}
        invites={created?.invites ?? []}
        existingAccounts={state.admins.length - (created?.invites.length ?? 0)}
        onClose={finish}
      />
    </ConsolePage>
  );
}
