import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  StarkZap,
  type SDKConfig,
  type Wallet,
  type CartridgeWalletInterface,
  type OnboardSignerOptions,
  type OnboardPrivyOptions,
  type OnboardCartridgeOptions,
  AvnuSwapProvider,
  EkuboSwapProvider,
  AvnuDcaProvider,
  EkuboDcaProvider,
} from "starkzap";
import { ZapContext } from "./context";
import type { ZapContextValue, ConnectionStatus } from "./context";
import { ZapDevPanel } from "./components/ZapDevPanel";

// ─── Types ────────────────────────────────────────────────────────

interface ZapProviderProps {
  config: SDKConfig;
  /** Bring-your-own QueryClient. If omitted, ZapProvider creates one internally. */
  queryClient?: QueryClient;
  /** Enable developer error panel. Defaults to false. */
  showDevPanel?: boolean;
  children: ReactNode;
}

const STORAGE_KEY = "zapkit_wallet_connected";

/** Default QueryClient config suitable for blockchain data: longer stale times, no window-focus refetch. */
function createDefaultQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 2,
        refetchOnWindowFocus: false,
      },
    },
  });
}

// ─── Provider (outer) — sets up QueryClient ───────────────────────

/**
 * Root provider for @zapkit/react. Wrap your app (or a subtree) with this.
 *
 * @example
 * <ZapProvider config={{ network: "mainnet" }}>
 *   <App />
 * </ZapProvider>
 */
export function ZapProvider({
  config,
  queryClient: externalQC,
  showDevPanel = false,
  children,
}: ZapProviderProps) {
  const [internalQC] = useState(() => externalQC ?? createDefaultQueryClient());

  return (
    <QueryClientProvider client={internalQC}>
      <ZapCore
        config={config}
        showDevPanel={showDevPanel}
        network={(config.network ?? "sepolia") as string}
      >
        {children}
      </ZapCore>
    </QueryClientProvider>
  );
}

// ─── Core (inner) — wallet state + context ────────────────────────

interface ZapCoreProps {
  config: SDKConfig;
  showDevPanel: boolean;
  network: string;
  children: ReactNode;
}

function ZapCore({ config, showDevPanel, network, children }: ZapCoreProps) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Stable StarkZap SDK instance — lazy useState ensures exactly one instance is
  // ever created, preventing a second setSdk call that would re-trigger the
  // auto-reconnect effect and cause a brief disconnect flash in StrictMode dev.
  const [sdk] = useState<StarkZap>(() => new StarkZap(config));
  const sdkRef = useRef<StarkZap>(sdk);

  // Cache Cartridge wallet to avoid re-creating the Controller iframe
  const cartridgeWalletRef = useRef<CartridgeWalletInterface | null>(null);

  // ─── Error classification ─────────────────────────────────────

  function isNonFatalError(err: Error, isAutoReconnect = false): boolean {
    const msg = err.message.toLowerCase();
    const name = (err.name ?? "").toLowerCase();

    if (
      name === "usercancellederror" ||
      name === "aborterror" ||
      msg.includes("user closed") ||
      msg.includes("user cancelled") ||
      msg.includes("user canceled") ||
      msg.includes("user rejected") ||
      msg.includes("user denied") ||
      msg.includes("user dismissed") ||
      msg.includes("popup closed") ||
      msg.includes("window closed")
    )
      return true;

    if (
      isAutoReconnect &&
      (msg.includes("cartridge controller failed to initialize") ||
        msg.includes("controller failed to initialize"))
    )
      return true;

    return false;
  }

  // ─── Connect helpers ──────────────────────────────────────────

  const connectSigner = useCallback(
    async (options: Omit<OnboardSignerOptions, "strategy" | "swapProviders">) => {
      const sc = sdkRef.current;
      if (!sc) return;
      setStatus("connecting");
      setLoading(true);
      setError(null);
      try {
        const result = await sc.onboard({
          ...options,
          strategy: "signer",
          swapProviders: [new AvnuSwapProvider(), new EkuboSwapProvider()],
          dcaProviders: [new AvnuDcaProvider(), new EkuboDcaProvider()],
          defaultDcaProviderId: "avnu",
        });
        setWallet(result.wallet as unknown as Wallet);
        setStatus("connected");
        localStorage.setItem(STORAGE_KEY, "signer");
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (isNonFatalError(e)) {
          setStatus("idle");
        } else {
          setError(e);
          setStatus("error");
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const connectPrivy = useCallback(
    async (options: Omit<OnboardPrivyOptions, "strategy" | "swapProviders">) => {
      const sc = sdkRef.current;
      if (!sc) return;
      setStatus("connecting");
      setLoading(true);
      setError(null);
      try {
        const result = await sc.onboard({
          ...options,
          strategy: "privy",
          swapProviders: [new AvnuSwapProvider(), new EkuboSwapProvider()],
          dcaProviders: [new AvnuDcaProvider(), new EkuboDcaProvider()],
          defaultDcaProviderId: "avnu",
        });
        setWallet(result.wallet as unknown as Wallet);
        setStatus("connected");
        localStorage.setItem(STORAGE_KEY, "privy");
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (isNonFatalError(e)) {
          setStatus("idle");
        } else {
          setError(e);
          setStatus("error");
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const connectCartridge = useCallback(
    async (
      options?: Omit<OnboardCartridgeOptions, "strategy" | "swapProviders"> & {
        isAutoReconnect?: boolean;
      },
    ) => {
      const sc = sdkRef.current;
      if (!sc) return;

      // Reuse cached Cartridge wallet if available
      if (cartridgeWalletRef.current) {
        setWallet(cartridgeWalletRef.current as unknown as Wallet);
        setStatus("connected");
        localStorage.setItem(STORAGE_KEY, "cartridge");
        return;
      }

      setStatus("connecting");
      setLoading(true);
      setError(null);
      try {
        const cartridgeWallet = await sc.connectCartridge(options);
        cartridgeWalletRef.current = cartridgeWallet;
        cartridgeWallet.registerSwapProvider(new AvnuSwapProvider());
        cartridgeWallet.registerSwapProvider(new EkuboSwapProvider());
        cartridgeWallet.setDefaultSwapProvider("avnu");
        cartridgeWallet.dca().registerProvider(new AvnuDcaProvider(), true);
        cartridgeWallet.dca().registerProvider(new EkuboDcaProvider());

        setWallet(cartridgeWallet as unknown as Wallet);
        setStatus("connected");
        localStorage.setItem(STORAGE_KEY, "cartridge");
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (isNonFatalError(e, options?.isAutoReconnect)) {
          localStorage.removeItem(STORAGE_KEY);
          setStatus("idle");
        } else {
          setError(e);
          setStatus("error");
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const disconnect = useCallback(async () => {
    // For Cartridge wallets, skip calling wallet.disconnect() —
    // the Controller is a page-level singleton; its disconnect() destroys
    // the keychain iframe, making reconnect impossible without a page reload.
    if (cartridgeWalletRef.current === (wallet as unknown)) {
      setWallet(null);
      setStatus("idle");
      setError(null);
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    try {
      await wallet?.disconnect();
    } catch {
      // Best-effort cleanup
    }
    setWallet(null);
    setStatus("idle");
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  }, [wallet]);

  // ─── Auto-reconnect Cartridge ──────────────────────────────────

  useEffect(() => {
    if (!sdk) return;
    const lastStrategy = localStorage.getItem(STORAGE_KEY);
    if (lastStrategy !== "cartridge") return;

    // Suppress starkzap's benign internal console errors during auto-reconnect
    const originalError = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      const msg = typeof args[0] === "string" ? args[0] : "";
      if (
        msg.includes("Failed to fetch price for") ||
        msg.includes("Insufficient liquidity in the routes")
      )
        return;
      originalError(...args);
    };

    void connectCartridge({ isAutoReconnect: true }).finally(() => {
      console.error = originalError;
    });
  }, [sdk]); // intentionally omit connectCartridge — run once on mount

  // ─── Context value ─────────────────────────────────────────────

  const value = useMemo<ZapContextValue>(
    () => ({
      sdk,
      wallet,
      network,
      status,
      isLoading: loading,
      error,
      connectSigner,
      connectPrivy,
      connectCartridge,
      disconnect,
      showDevPanel,
    }),
    [
      sdk,
      wallet,
      network,
      status,
      loading,
      error,
      connectSigner,
      connectPrivy,
      connectCartridge,
      disconnect,
      showDevPanel,
    ],
  );

  return (
    <ZapContext.Provider value={value}>
      {children}
      {showDevPanel && (
        <ZapDevPanel
          error={error}
          status={status}
          address={wallet?.address ? String(wallet.address) : null}
        />
      )}
    </ZapContext.Provider>
  );
}
