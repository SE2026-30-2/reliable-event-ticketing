import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { messageOf } from "@/lib/types";

export function useLiveResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  interval = 5000,
) {
  const [result, setResult] = useState<{
    loader: typeof loader;
    data?: T;
    error: string;
  }>();
  const refresh = useRef<(() => void) | null>(null);
  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      let busy = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const load = async () => {
        if (
          busy ||
          controller.signal.aborted ||
          AppState.currentState !== "active"
        )
          return;
        busy = true;
        clearTimeout(timer);
        try {
          const data = await loader(controller.signal);
          if (!controller.signal.aborted)
            setResult({ loader, data, error: "" });
        } catch (error) {
          if (!controller.signal.aborted)
            setResult((old) => ({
              loader,
              data: old?.loader === loader ? old.data : undefined,
              error: messageOf(error),
            }));
        } finally {
          busy = false;
          if (!controller.signal.aborted && AppState.currentState === "active")
            timer = setTimeout(load, interval);
        }
      };
      refresh.current = () => {
        void load();
      };
      void load();
      const subscription = AppState.addEventListener("change", (state) => {
        clearTimeout(timer);
        if (state === "active") void load();
      });
      return () => {
        controller.abort();
        clearTimeout(timer);
        subscription.remove();
        refresh.current = null;
      };
    }, [loader, interval]),
  );
  const current = result?.loader === loader;
  return {
    data: current ? result.data : undefined,
    error: current ? result.error : "",
    loading: !current || (!result.data && !result.error),
    reload: useCallback(() => refresh.current?.(), []),
  };
}
