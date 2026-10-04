import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import KeyboardArrowDownIcon from '@material-ui/icons/KeyboardArrowDown';
import { Capability, Ministry } from '../../types';
import { ErrorState, FieldInput, FormField, LoadingState } from '../Common';
import { CapabilityCard } from './CapabilityCard';
import { useStepStyles } from './styles';
import { DetailsErrors, WizardState } from './wizard';

/** Step 1: ministry, name, short code and what the department can use. */
export function DetailsStep(props: {
  state: WizardState;
  errors: DetailsErrors;
  ministries: Ministry[];
  catalog: {
    loading: boolean;
    error?: Error;
    value?: Capability[];
    reload: () => void;
  };
  onChange: (changes: Partial<WizardState>) => void;
}) {
  const classes = useStepStyles();
  const { state, errors, onChange } = props;

  const toggle = (id: string, checked: boolean) =>
    onChange({
      capabilities: checked
        ? [...state.capabilities, id]
        : state.capabilities.filter(c => c !== id),
    });

  return (
    <>
      <section className={classes.section} aria-labelledby="department-section">
        <h2 id="department-section" className={classes.sectionTitle}>
          Department
        </h2>
        <FormField
          id="ministry"
          label="Ministry"
          required
          info="The ministry this department belongs to"
          helper="Select a ministry from the list, or create a new one in the Ministry section."
          error={errors.ministryId}
        >
          <Select
            value={state.ministryId}
            displayEmpty
            onChange={e => onChange({ ministryId: e.target.value as string })}
            input={<FieldInput id="ministry" invalid={!!errors.ministryId} />}
            IconComponent={KeyboardArrowDownIcon}
            className={classes.select}
            renderValue={value =>
              value ? (
                props.ministries.find(m => m.id === value)?.name
              ) : (
                <span className={classes.placeholder}>Select a ministry</span>
              )
            }
            MenuProps={{
              getContentAnchorEl: null,
              anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
            }}
          >
            {props.ministries.map(m => (
              <MenuItem key={m.id} value={m.id}>
                {m.name}
              </MenuItem>
            ))}
          </Select>
        </FormField>
        <div className={classes.twoColumns}>
          <FormField
            id="department-name"
            label="Department name"
            required
            info="The full name of the department or agency"
            error={errors.name}
          >
            <FieldInput
              id="department-name"
              value={state.name}
              placeholder="e.g. DigiLocker"
              onChange={e => onChange({ name: e.target.value })}
              invalid={!!errors.name}
            />
          </FormField>
          <FormField
            id="short-code"
            label="Short Code"
            required
            info="A short identifier, e.g. DIGI"
            helper="Unique on the platform. Can't be changed later."
            error={errors.shortCode}
          >
            <FieldInput
              id="short-code"
              value={state.shortCode}
              placeholder="e.g. DIGI"
              onChange={e =>
                onChange({ shortCode: e.target.value.toUpperCase() })
              }
              invalid={!!errors.shortCode}
              inputProps={{ maxLength: 20, autoCapitalize: 'characters' }}
            />
          </FormField>
        </div>
      </section>

      <section
        className={classes.section}
        aria-labelledby="capabilities-section"
      >
        <h2 id="capabilities-section" className={classes.sectionTitle}>
          What this Department can use
        </h2>
        <p className={classes.sectionSubtitle}>
          Enable areas and optional tools. Disabled items stay hidden for this
          department.
        </p>
        {errors.capabilities && (
          <span className={classes.sectionError} role="alert">
            {errors.capabilities}
          </span>
        )}
        {props.catalog.error && (
          <ErrorState
            title="Unable to load what departments can use"
            error={props.catalog.error}
            onRetry={props.catalog.reload}
          />
        )}
        {props.catalog.loading && !props.catalog.value && <LoadingState />}
        {props.catalog.value?.map(capability => (
          <CapabilityCard
            key={capability.id}
            capability={capability}
            checked={state.capabilities.includes(capability.id)}
            onChange={checked => toggle(capability.id, checked)}
          />
        ))}
      </section>
    </>
  );
}
