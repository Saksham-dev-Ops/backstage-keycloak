import { useEffect, useState } from 'react';
import MenuItem from '@material-ui/core/MenuItem';
import { AddUserRequest, TENANT_ROLES, TenantRole } from '../../types';
import { ROLE_LABELS } from '../../utils/format';
import { email, FieldErrors, hasErrors } from '../../utils/validation';
import { FormDialog, TextInput } from '../Common';

type Field = 'name' | 'email' | 'role';

export function validateUser(values: Record<Field, string>): FieldErrors<Field> {
  return {
    name:
      values.name.trim() && values.name.trim().length < 2
        ? 'Name must be at least 2 characters'
        : undefined,
    email: email(values.email),
    role: values.role ? undefined : 'Select a role',
  };
}

/** Adds a user (or admin) to a department. */
export function UserForm(props: {
  open: boolean;
  departmentName: string;
  defaultRole?: TenantRole;
  onClose: () => void;
  onSubmit: (body: AddUserRequest) => Promise<unknown>;
}) {
  const initial = { name: '', email: '', role: props.defaultRole ?? 'DEVELOPER' };
  const [values, setValues] = useState<Record<Field, string>>(initial);
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string>();

  useEffect(() => {
    if (props.open) {
      setValues({ name: '', email: '', role: props.defaultRole ?? 'DEVELOPER' });
      setErrors({});
      setApiError(undefined);
    }
  }, [props.open, props.defaultRole]);

  const submit = async () => {
    const found = validateUser(values);
    setErrors(found);
    if (hasErrors(found)) {
      return;
    }
    setSubmitting(true);
    setApiError(undefined);
    try {
      await props.onSubmit({
        name: values.name.trim() || undefined,
        email: values.email.trim(),
        role: values.role as TenantRole,
      });
      props.onClose();
    } catch (error) {
      setApiError((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const field = (name: Field) => ({
    value: values[name],
    onChange: (e: { target: { value: string } }) => setValues({ ...values, [name]: e.target.value }),
    error: !!errors[name],
    helperText: errors[name],
    disabled: submitting,
  });

  return (
    <FormDialog
      open={props.open}
      title="Add user"
      description={`Add a user to ${props.departmentName}. They sign in with Keycloak using this email. Owners and admins manage the department.`}
      submitLabel="Add user"
      submitting={submitting}
      error={apiError}
      onClose={props.onClose}
      onSubmit={submit}
    >
      <TextInput label="Name" {...field('name')} />
      <TextInput label="Email" type="email" required {...field('email')} />
      <TextInput select label="Role" required {...field('role')}>
        {TENANT_ROLES.map(role => (
          <MenuItem key={role} value={role}>
            {ROLE_LABELS[role]}
          </MenuItem>
        ))}
      </TextInput>
    </FormDialog>
  );
}
