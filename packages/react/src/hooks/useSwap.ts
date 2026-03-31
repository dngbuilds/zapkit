import { useMutation, useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useZapContext } from "../context";
import { type Token, type SwapInput, type SwapQuote, type ExecuteOptions, type Tx } from "starkzap";
import { getPresets, mainnetTokens } from "starkzap";

// Re-export Token so consumers can type token variables without importing starkzap directly.
export type { Token };

// ─── Standalone mutation hooks ─────────────────────────────────────────────────

/** Returns a symbol-keyed map of preset tokens for the connected network (or mainnet if not connected). */
export function usePresetTokens(): Record<string, Token> {
  const { wallet } = useZapContext();
  if (!wallet) return mainnetTokens as Record<string, Token>;
  const tokens = getPresets(wallet.getChainId());
  return (tokens ?? mainnetTokens) as Record<string, Token>;
}

export function useGetQuoteQuery(
  request: (SwapInput & { provider?: string }) | null,
  options?: Partial<UseQueryOptions<SwapQuote>>,
) {
  const { wallet } = useZapContext();

  return useQuery<SwapQuote, Error>({
    // Keep query key serializable — no Amount objects
    queryKey: [
      "swap",
      "quote",
      request?.provider ?? "default",
      request?.tokenIn?.symbol ?? "",
      request?.tokenOut?.symbol ?? "",
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      String(request?.amountIn ?? ""),
      String(request?.slippageBps ?? "0"),
    ],
    queryFn: async () => {
      if (!wallet) throw new Error("Wallet not connected.");
      if (!request) throw new Error("No request provided.");
      return wallet.getQuote(request);
    },
    enabled: !!wallet && !!request,
    staleTime: 30_000,
    gcTime: 60_000,
    retry: 1,
    ...options,
  });
}

/** Fetch a swap quote without executing the trade. */
export function useGetQuoteMutation() {
  const { wallet } = useZapContext();
  const m = useMutation<SwapQuote, Error, SwapInput>({
    mutationFn: async (request) => {
      if (!wallet) throw new Error("Wallet not connected.");
      return wallet.getQuote(request);
    },
  });
  return {
    getQuote: m.mutateAsync,
    isQuoting: m.isPending,
    quoteError: m.error,
    quote: m.data,
    reset: m.reset,
  };
}

/** Execute a swap. Calls `wallet.swap()` then waits for confirmation. */
export function useSwapMutation() {
  const { wallet } = useZapContext();
  const m = useMutation<Tx, Error, { request: SwapInput; options?: ExecuteOptions }>({
    mutationFn: async ({ request, options }) => {
      if (!wallet) throw new Error("Wallet not connected.");
      const tx = await wallet.swap(request, options);
      await tx.wait();
      return tx;
    },
  });
  return {
    swap: m.mutateAsync,
    isSwapping: m.isPending,
    swapError: m.error,
    lastTx: m.data,
    reset: m.reset,
  };
}

// ─── Composed all-in-one hook ──────────────────────────────────────────────────

export function useSwap() {
  const { wallet } = useZapContext();
  const quoteM = useGetQuoteMutation();
  const swapM = useSwapMutation();

  return {
    // ─── Quote ────────────────────────────────────────────────────
    getQuote: quoteM.getQuote,
    quote: quoteM.quote,
    isQuoting: quoteM.isQuoting,
    quoteError: quoteM.quoteError,

    // ─── Swap execution ──────────────────────────────────────────
    swap: swapM.swap,
    isSwapping: swapM.isSwapping,
    swapError: swapM.swapError,
    lastTx: swapM.lastTx,

    // ─── Provider helpers (call wallet directly) ─────────────────
    listProviders: (): string[] => wallet?.listSwapProviders() ?? [],
    registerProvider: wallet?.registerSwapProvider?.bind(wallet),
    setDefaultProvider: wallet?.setDefaultSwapProvider?.bind(wallet),

    // ─── Aggregate state ──────────────────────────────────────────
    isPending: quoteM.isQuoting || swapM.isSwapping,
    isError: !!quoteM.quoteError || !!swapM.swapError,
    error: quoteM.quoteError ?? swapM.swapError,
    reset: () => {
      quoteM.reset();
      swapM.reset();
    },
  };
}
