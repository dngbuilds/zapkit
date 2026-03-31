import {
  useContext,
  useReducer,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { HeaderActionsContext } from "./header-actions-context";

export { HeaderActionsContext } from "./header-actions-context";

/**
 * Provides header action registration without causing Provider re-renders.
 * Actions are stored in a ref; only the HeaderActionsSlot re-renders when they change.
 */
export function HeaderActionsProvider({ children }: { children: ReactNode }) {
  const actionsRef = useRef<ReactNode>(null);
  const slotUpdateRef = useRef<(() => void) | null>(null);

  const setActions = useCallback((node: ReactNode) => {
    actionsRef.current = node;
    slotUpdateRef.current?.();
  }, []);

  const value = useMemo(() => ({ actionsRef, slotUpdateRef, setActions }), [setActions]);

  return <HeaderActionsContext.Provider value={value}>{children}</HeaderActionsContext.Provider>;
}

/** Renders the currently registered header actions. Only this component re-renders on updates. */
export function HeaderActionsSlot() {
  const { actionsRef, slotUpdateRef } = useContext(HeaderActionsContext);
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    slotUpdateRef.current = forceUpdate;
    return () => {
      slotUpdateRef.current = null;
    };
  }, [slotUpdateRef]);

  return <>{actionsRef.current}</>;
}
