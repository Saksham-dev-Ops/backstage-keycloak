import { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import MenuItem from '@material-ui/core/MenuItem';
import Typography from '@material-ui/core/Typography';
import { Department, Ministry, UpdateDepartmentRequest } from '../../types';
import { tokens } from '../../utils/tokens';
import {
  FieldErrors,
  hasErrors,
  limit,
  requiredName,
} from '../../utils/validation';
import { FormDialog, TextInput } from '../Common';

type Field = 'name' | 'ministryId' | 'userLimit' | 'projectLimit';

type Values = Record<Field, string>;

const useStyles = makeStyles({
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  section: { fontSize: 13, fontWeight: 600, color: tokens.text, marginTop: 4 },
});

function initialValues(department: Department): Values {
  return {
    name: department?.name ?? '',
    ministryId: department?.ministry?.id ?? '',
    userLimit: department?.userLimit?.toString() ?? '',
    projectLimit: department?.projectLimit?.toString() ?? '',
  };
}

export function validateDepartment(values: Values): FieldErrors<Field> {
  return {
    name: requiredName(values.name, 'Department name'),
    ministryId: values.ministryId ? undefined : 'Select a ministry',
    userLimit: limit(values.userLimit, 'User limit'),
    projectLimit: limit(values.projectLimit, 'Project limit'),
  };
}

/**
 * Edits the name, ministry and limits of a department. New departments are
 * added through the multi-step Add Department page.
 */
export function DepartmentForm(props: {
  open: boolean;
  department: Department;
  ministries: Ministry[];
  onClose: () => void;
  onUpdate: (id: string, body: UpdateDepartmentRequest) => Promise<unknown>;
}) {
  const classes = useStyles();
  const [values, setValues] = useState<Values>(() =>
    initialValues(props.department),
  );
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string>();

  useEffect(() => {
    if (props.open) {
      setValues(initialValues(props.department));
      setErrors({});
      setSubmitted(false);
      setApiError(undefined);
    }
  }, [props.open, props.department]);

  const set = (field: Field) => (event: { target: { value: string } }) => {
    const next = { ...values, [field]: event.target.value };
    setValues(next);
    if (submitted) {
      setErrors(validateDepartment(next));
    }
  };

  const submit = async () => {
    setSubmitted(true);
    const found = validateDepartment(values);
    setErrors(found);
    if (hasErrors(found)) {
      return;
    }
    setSubmitting(true);
    setApiError(undefined);
    try {
      await props.onUpdate(props.department.id, {
        name: values.name.trim(),
        ministryId: values.ministryId,
        userLimit: Number(values.userLimit),
        projectLimit: Number(values.projectLimit),
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
    onChange: set(name),
    error: !!errors[name],
    helperText: errors[name],
    disabled: submitting,
  });

  return (
    <FormDialog
      open={props.open}
      title="Edit Department"
      description="Change the name, ministry or limits of this department."
      submitLabel="Save changes"
      submitting={submitting}
      error={apiError}
      onClose={props.onClose}
      onSubmit={submit}
    >
      <TextInput label="Department name" required {...field('name')} />
      <TextInput select label="Ministry" required {...field('ministryId')}>
        {props.ministries.map(m => (
          <MenuItem key={m.id} value={m.id}>
            {m.name}
          </MenuItem>
        ))}
      </TextInput>
      <Typography className={classes.section}>Limits</Typography>
      <div className={classes.row}>
        <TextInput
          label="User limit"
          type="number"
          required
          inputProps={{ min: 1 }}
          {...field('userLimit')}
        />
        <TextInput
          label="Project limit"
          type="number"
          required
          inputProps={{ min: 1 }}
          {...field('projectLimit')}
        />
      </div>
    </FormDialog>
  );
}
