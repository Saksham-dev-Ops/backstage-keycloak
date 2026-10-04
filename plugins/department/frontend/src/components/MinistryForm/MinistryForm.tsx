import { useEffect, useState } from 'react';
import { Ministry } from '../../types';
import { FieldErrors, hasErrors, requiredName } from '../../utils/validation';
import { FormDialog, TextInput } from '../Common';

type Field = 'name' | 'description';

export function MinistryForm(props: {
  open: boolean;
  ministry?: Ministry;
  onClose: () => void;
  onSubmit: (body: { name: string; description?: string }) => Promise<unknown>;
}) {
  const [values, setValues] = useState({ name: '', description: '' });
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string>();

  useEffect(() => {
    if (props.open) {
      setValues({ name: props.ministry?.name ?? '', description: props.ministry?.description ?? '' });
      setErrors({});
      setApiError(undefined);
    }
  }, [props.open, props.ministry]);

  const submit = async () => {
    const found: FieldErrors<Field> = {
      name: requiredName(values.name, 'Ministry name'),
      description:
        values.description.length > 2000 ? 'Description must be at most 2000 characters' : undefined,
    };
    setErrors(found);
    if (hasErrors(found)) {
      return;
    }
    setSubmitting(true);
    setApiError(undefined);
    try {
      await props.onSubmit({
        name: values.name.trim(),
        description: values.description.trim() || undefined,
      });
      props.onClose();
    } catch (error) {
      setApiError((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={props.open}
      title={props.ministry ? 'Edit Ministry' : 'Add Ministry'}
      description="Ministries group the departments of the platform."
      submitLabel={props.ministry ? 'Save changes' : 'Add Ministry'}
      submitting={submitting}
      error={apiError}
      onClose={props.onClose}
      onSubmit={submit}
    >
      <TextInput
        label="Ministry name"
        required
        value={values.name}
        onChange={e => setValues({ ...values, name: e.target.value })}
        error={!!errors.name}
        helperText={errors.name}
        disabled={submitting}
      />
      <TextInput
        label="Description"
        multiline
        minRows={3}
        value={values.description}
        onChange={e => setValues({ ...values, description: e.target.value })}
        error={!!errors.description}
        helperText={errors.description}
        disabled={submitting}
      />
    </FormDialog>
  );
}
