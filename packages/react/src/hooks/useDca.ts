import { useMutation, useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useZapContext } from "../context";
import type {
  DcaCreateInput,
  DcaCancelInput,
  DcaOrdersInput,
  DcaOrdersPage,
  DcaOrder,
  DcaTrade,
  DcaCyclePreviewRequest,
  ExecuteOptions,
} from "starkzap";
import type { SwapQuote, Tx } from "starkzap";

export type { DcaOrder, DcaTrade, DcaOrdersPage, DcaCreateInput, DcaCancelInput, DcaOrdersInput };

// ─── List orders query ─────────────────────────────────────────────────────────

/**
 * Reactive query that fetches DCA orders for the connected wallet.
 * Pass `{ status: "ACTIVE" }` to show only live orders.
 */
export function useDcaOrdersQuery(
  input?: Omit<DcaOrdersInput, "traderAddress">,
  options?: Partial<UseQueryOptions<DcaOrdersPage>>,
) {
  const { wallet } = useZapContext();

  return useQuery<DcaOrdersPage, Error>({
    queryKey: [
      "dca",
      "orders",
      input?.provider ?? "default",
      input?.status ?? "all",
      input?.page ?? 0,
    ],
    queryFn: async () => {
      if (!wallet) throw new Error("Wallet not connected.");
      return wallet.dca().getOrders(input ?? {});
    },
    enabled: !!wallet,
    staleTime: 30_000,
    gcTime: 60_000,
    retry: 1,
    ...options,
  });
}

// ─── Create mutation ───────────────────────────────────────────────────────────

export function useCreateDcaMutation() {
  const { wallet } = useZapContext();

  const m = useMutation<Tx, Error, { request: DcaCreateInput; options?: ExecuteOptions }>({
    mutationFn: async ({ request, options }) => {
      if (!wallet) throw new Error("Wallet not connected.");
      const tx = await wallet.dca().create(request, options);
      await tx.wait();
      return tx;
    },
  });

  return {
    createOrder: m.mutateAsync,
    isCreating: m.isPending,
    createError: m.error,
    lastTx: m.data,
    reset: m.reset,
  };
}

// ─── Cancel mutation ───────────────────────────────────────────────────────────

export function useCancelDcaMutation() {
  const { wallet } = useZapContext();

  const m = useMutation<Tx, Error, { request: DcaCancelInput; options?: ExecuteOptions }>({
    mutationFn: async ({ request, options }) => {
      if (!wallet) throw new Error("Wallet not connected.");
      const tx = await wallet.dca().cancel(request, options);
      await tx.wait();
      return tx;
    },
  });

  return {
    cancelOrder: m.mutateAsync,
    isCancelling: m.isPending,
    cancelError: m.error,
    reset: m.reset,
  };
}

// ─── Preview cycle mutation ────────────────────────────────────────────────────

/**
 * Preview the expected buy amount for a single DCA cycle.
 * Uses the default swap provider for quoting.
 */
export function usePreviewDcaCycleMutation() {
  const { wallet } = useZapContext();

  const m = useMutation<SwapQuote, Error, DcaCyclePreviewRequest>({
    mutationFn: async (request) => {
      if (!wallet) throw new Error("Wallet not connected.");
      return wallet.dca().previewCycle(request);
    },
  });

  return {
    previewCycle: m.mutateAsync,
    isPreviewing: m.isPending,
    preview: m.data,
    previewError: m.error,
    resetPreview: m.reset,
  };
}
