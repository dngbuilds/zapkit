import {
  createContext,
  createRef,
  type ReactNode,
  type RefObject,
} from "react";

export interface HeaderActionsContextValue {
  /** Ref holding the current slot content — never causes Provider re-renders. */
  actionsRef: RefObject<ReactNode>;
  /** Ref to the Slot's forceUpdate — called only to re-render the Slot itself. */
  slotUpdateRef: RefObject<(() => void) | null>;
  setActions: (node: ReactNode) => void;
}

export const HeaderActionsContext = createContext<HeaderActionsContextValue>({
  actionsRef: createRef<ReactNode>(),
  slotUpdateRef: createRef<(() => void) | null>(),
  setActions: () => {},
});
