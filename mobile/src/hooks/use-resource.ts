import { useCallback, useEffect, useState } from "react";
import { messageOf } from "@/lib/types";
export function useResource<T>(loader: (signal: AbortSignal) => Promise<T>) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    loader: typeof loader;
    revision: number;
    data?: T;
    error: string;
  }>();
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    loader(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setResult({ loader, revision, data, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({ loader, revision, error: messageOf(error) });
      });
    return () => controller.abort();
  }, [loader, revision]);
  const current = result?.loader === loader && result?.revision === revision;
  return {
    data: current ? result.data : undefined,
    loading: !current,
    error: current ? result.error : "",
    reload,
  };
}
