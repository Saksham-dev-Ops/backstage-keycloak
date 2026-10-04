import { FormEvent, useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import IconButton from '@material-ui/core/IconButton';
import InputAdornment from '@material-ui/core/InputAdornment';
import Typography from '@material-ui/core/Typography';
import CloseIcon from '@material-ui/icons/Close';
import { tokens } from '../../utils/tokens';
import { hasErrors } from '../../utils/validation';
import { FieldInput, FormField } from '../Common';
import { ADMIN_GROUP } from './AdminTable';
import { AdminDraft, AdminErrors, COUNTRY_CODE, validateAdmin } from './wizard';

const useStyles = makeStyles({
  paper: {
    width: 420,
    maxWidth: 'calc(100% - 32px)',
    margin: 16,
    borderRadius: 10,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    padding: '16px 20px',
    background: '#F3F6FD',
    borderBottom: `1px solid ${tokens.border}`,
  },
  title: { fontSize: 16, fontWeight: 700, color: tokens.text },
  subtitle: { fontSize: 12, color: tokens.textBody, marginTop: 2 },
  close: {
    border: `1px solid ${tokens.primary}`,
    borderRadius: 6,
    color: tokens.primary,
    padding: 4,
  },
  body: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    maxHeight: '60vh',
    overflowY: 'auto',
  },
  prefix: { fontSize: 14, color: tokens.text, marginRight: 6 },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    padding: '14px 20px',
    borderTop: `1px solid ${tokens.border}`,
  },
  cancel: { textTransform: 'none', color: tokens.text },
  submit: {
    textTransform: 'none',
    background: tokens.primary,
    boxShadow: 'none',
    borderRadius: 6,
    '&:hover': { background: tokens.primaryHover, boxShadow: 'none' },
  },
});

const EMPTY = { name: '', email: '', designation: '', mobile: '' };

/** "Add Department admin": name, official email, designation and mobile. */
export function AdminDialog(props: {
  open: boolean;
  departmentName: string;
  /** Edits this admin; adds a new one when undefined */
  admin?: AdminDraft;
  /** Admins already added, to prevent duplicates */
  others: AdminDraft[];
  onClose: () => void;
  onSave: (admin: Omit<AdminDraft, 'key'>) => void;
}) {
  const classes = useStyles();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<AdminErrors>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (props.open) {
      setValues(props.admin ? { ...props.admin } : EMPTY);
      setErrors({});
      setSubmitted(false);
    }
  }, [props.open, props.admin]);

  const set = (field: keyof typeof EMPTY, value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    if (submitted) setErrors(validateAdmin(next, props.others));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    const found = validateAdmin(values, props.others);
    setErrors(found);
    if (hasErrors(found)) return;
    props.onSave({
      name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
      designation: values.designation.trim(),
      mobile: values.mobile,
    });
  };

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      classes={{ paper: classes.paper }}
      aria-labelledby="admin-dialog-title"
    >
      <form onSubmit={submit} noValidate>
        <div className={classes.header}>
          <div>
            <Typography
              id="admin-dialog-title"
              component="h2"
              className={classes.title}
            >
              {props.admin ? 'Edit Department admin' : 'Add Department admin'}
            </Typography>
            <Typography className={classes.subtitle}>
              This person will manage roles, groups, people and projects for{' '}
              {props.departmentName}.
            </Typography>
          </div>
          <IconButton
            className={classes.close}
            onClick={props.onClose}
            aria-label="Close"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
        <div className={classes.body}>
          <FormField
            id="admin-name"
            label="Full Name"
            required
            info="As it should appear to others"
            error={errors.name}
          >
            <FieldInput
              id="admin-name"
              placeholder="Enter Name"
              value={values.name}
              onChange={e => set('name', e.target.value)}
              invalid={!!errors.name}
            />
          </FormField>
          <FormField
            id="admin-email"
            label="Official email"
            required
            info="Their government email address"
            helper="This becomes their sign-in ID"
            error={errors.email}
          >
            <FieldInput
              id="admin-email"
              type="email"
              placeholder="Enter email address"
              value={values.email}
              onChange={e => set('email', e.target.value)}
              invalid={!!errors.email}
            />
          </FormField>
          <FormField
            id="admin-designation"
            label="Designation"
            required
            info="Their job title"
            error={errors.designation}
          >
            <FieldInput
              id="admin-designation"
              placeholder="eg. Senior Director"
              value={values.designation}
              onChange={e => set('designation', e.target.value)}
              invalid={!!errors.designation}
            />
          </FormField>
          <FormField
            id="admin-mobile"
            label="Mobile"
            required
            info="A 10-digit mobile number"
            helper="For account recovery only"
            error={errors.mobile}
          >
            <FieldInput
              id="admin-mobile"
              type="tel"
              value={values.mobile}
              onChange={e =>
                set('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))
              }
              invalid={!!errors.mobile}
              inputProps={{
                inputMode: 'numeric',
                'aria-label': 'Mobile number without country code',
              }}
              startAdornment={
                <InputAdornment
                  position="start"
                  disableTypography
                  className={classes.prefix}
                >
                  {COUNTRY_CODE}
                </InputAdornment>
              }
            />
          </FormField>
          <FormField
            id="admin-department"
            label="Department"
            info="The department being added"
            helper="Pre-filled from Department details"
          >
            <FieldInput
              id="admin-department"
              value={props.departmentName}
              disabled
            />
          </FormField>
          <FormField
            id="admin-group"
            label="Group"
            info="The group this admin joins"
            helper="Fixed for this step"
          >
            <FieldInput
              id="admin-group"
              value={`${ADMIN_GROUP} (Organisation admin)`}
              disabled
            />
          </FormField>
        </div>
        <div className={classes.footer}>
          <Button className={classes.cancel} onClick={props.onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            className={classes.submit}
          >
            {props.admin ? 'Save Admin' : 'Add Admin'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
