import { useEffect, useState } from 'react';
import { managementError } from '../../services/manageEventService';

export function useResource(loader, args, refresh = 0) {
  const argsKey = JSON.stringify(args);
  const key = `${argsKey}:${refresh}`;
  const [result, setResult] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    loader(...JSON.parse(argsKey), controller.signal).then((data) => {
      if (!controller.signal.aborted) setResult({ key, data });
    }).catch((error) => {
      if (!controller.signal.aborted) setResult({ key, error: managementError(error) });
    });
    return () => controller.abort();
  }, [loader, argsKey, key]);
  return result?.key === key ? { ...result, loading: false } : { loading: true };
}
