import { DependencyList, useCallback, useEffect, useState } from 'react';
import { alertApiRef, useApi } from '@backstage/core-plugin-api';
import MenuItem from '@material-ui/core/MenuItem';
import TextField from '@material-ui/core/TextField';
import { Environment } from '../api';

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

/** Loads data and exposes a reload function; stale results are discarded. */
export function useLoader<T>(load: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<{ value?: T; error?: Error; loading: boolean }>({
    loading: true,
  });
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoized = useCallback(load, deps);

  useEffect(() => {
    let cancelled = false;
    setState(s => ({ ...s, loading: true }));
    memoized().then(
      value => !cancelled && setState({ value, loading: false }),
      error => !cancelled && setState({ error, loading: false }),
    );
    return () => {
      cancelled = true;
    };
  }, [memoized, version]);

  return { ...state, reload: () => setVersion(v => v + 1) };
}

/** Runs a mutation and reports the outcome through the alert API. */
export function useAction() {
  const alertApi = useApi(alertApiRef);
  return useCallback(
    async (action: () => Promise<unknown>, success: string) => {
      try {
        await action();
        alertApi.post({ message: success, severity: 'success', display: 'transient' });
        return true;
      } catch (e) {
        alertApi.post({ message: (e as Error).message, severity: 'error' });
        return false;
      }
    },
    [alertApi],
  );
}

export function confirmAction(message: string) {
  // eslint-disable-next-line no-alert
  return window.confirm(message);
}

export function EnvironmentSelect(props: {
  environments: Environment[];
  value?: string;
  onChange: (environmentId: string) => void;
}) {
  return (
    <TextField
      select
      label="Environment"
      variant="outlined"
      size="small"
      style={{ minWidth: 220 }}
      value={props.value ?? ''}
      onChange={e => props.onChange(e.target.value)}
    >
      {props.environments.map(env => (
        <MenuItem key={env.id} value={env.id}>
          {env.name}
        </MenuItem>
      ))}
    </TextField>
  );
}
