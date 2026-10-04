import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';

export type AsyncState<T> = {
  loading: boolean;
  error?: Error;
  value?: T;
  reload: () => void;
};

/**
 * Runs a loader when its dependencies change and on `reload()`. Results of
 * superseded runs are ignored, so fast filter changes cannot show stale data.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<{ loading: boolean; error?: Error; value?: T }>({
    loading: true,
  });
  const [version, setVersion] = useState(0);
  const run = useRef(0);

  useEffect(() => {
    const current = ++run.current;
    setState(s => ({ ...s, loading: true, error: undefined }));
    loader().then(
      value => current === run.current && setState({ loading: false, value }),
      error => current === run.current && setState(s => ({ ...s, loading: false, error })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const reload = useCallback(() => setVersion(v => v + 1), []);
  return { ...state, reload };
}
