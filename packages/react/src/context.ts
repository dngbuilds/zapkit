import type {
  OnboardCartridgeOptions,
  OnboardPrivyOptions,
  OnboardSignerOptions,
  Wallet,
} from "starkzap";
import type { StarkZap } from "starkzap";
import { createContext, useContext } from "react";

// ─── Connection state ────────────────────────────────────────────

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

// ─── Full context value ───────────────────────────────────────────
export interface ZapContextValue {
  /** The underlying StarkZap SDK instance (needed for pool discovery, bridging tokens, etc.) */
  sdk: StarkZap;
  /** The connected starkzap Wallet — null until connected. All feature hooks use this directly. */
  wallet: Wallet | null;
  /** The configured network name (e.g. "mainnet", "sepolia") */
  network: string;

  // ─── Connection state & actions ──────────────────────────────
  status: ConnectionStatus;
  isLoading: boolean;
  error: Error | null;

  connectSigner: (
    options: Omit<OnboardSignerOptions, "strategy" | "swapProviders">,
  ) => Promise<void>;

  connectPrivy: (options: Omit<OnboardPrivyOptions, "strategy" | "swapProviders">) => Promise<void>;

  connectCartridge: (
    options?: Omit<OnboardCartridgeOptions, "strategy" | "swapProviders"> & {
      isAutoReconnect?: boolean;
    },
  ) => Promise<void>;

  disconnect: () => Promise<void>;
  showDevPanel?: boolean;
}

export const ZapContext = createContext<ZapContextValue | undefined>(undefined);

/** Internal helper — throws a clear error outside ZapProvider */
export function useZapContext(): ZapContextValue {
  const ctx = useContext(ZapContext);
  if (!ctx) {
    throw new Error(
      "🚫 ZapKit: hook used outside <ZapProvider>. Wrap your app with <ZapProvider config={...}>.",
    );
  }
  return ctx;
}
