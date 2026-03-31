import { useMutation, useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useZapContext } from "../context";
import type { Token, ExecuteOptions, Tx } from "starkzap";
import type {
  LendingMarket,
  LendingPosition,
  LendingHealth,
  LendingDepositRequest,
  LendingWithdrawRequest,
  LendingWithdrawMaxRequest,
  LendingBorrowRequest,
  LendingRepayRequest,
  LendingPositionRequest,
  LendingHealthRequest,
  LendingUserPosition,
  LendingUserPositionsRequest,
} from "starkzap";

export type {
  LendingMarket,
  LendingPosition,
  LendingHealth,
  LendingDepositRequest,
  LendingWithdrawRequest,
  LendingWithdrawMaxRequest,
  LendingBorrowRequest,
  LendingRepayRequest,
  LendingPositionRequest,
  LendingHealthRequest,
  LendingUserPosition,
};

// ─── Markets query ─────────────────────────────────────────────────────────────

/**
 * Fetch available lending markets for the current chain.
 * Cached for 60 s — call once at the page level and pass markets down.
 *
 * @example
 * const { data: markets, isLoading } = useLendingMarketsQuery();
 */
export function useLendingMarketsQuery(options?: Partial<UseQueryOptions<LendingMarket[]>>) {
  const { wallet } = useZapContext();

  return useQuery<LendingMarket[], Error>({
    queryKey: ["lending", "markets"],
    queryFn: async () => {
      if (!wallet) throw new Error("Wallet not connected.");
      return wallet.lending().getMarkets();
    },
    enabled: !!wallet,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
    ...options,
  });
}

// ─── User positions query ──────────────────────────────────────────────────────

/**
 * Fetch all of the connected user's lending/borrow positions.
 * Returns both "earn" (supply) and "borrow" position types.
 *
 * @example
 * const { data: positions } = useLendingUserPositionsQuery();
 */
export function useLendingUserPositionsQuery(
  request?: LendingUserPositionsRequest,
  options?: Partial<UseQueryOptions<LendingUserPosition[]>>,
) {
  const { wallet } = useZapContext();

  return useQuery<LendingUserPosition[], Error>({
    queryKey: ["lending", "positions", "all", request?.provider ?? "default"],
    queryFn: async () => {
      if (!wallet) throw new Error("Wallet not connected.");
      return wallet.lending().getPositions(request ?? {});
    },
    enabled: !!wallet,
    staleTime: 30_000,
    gcTime: 60_000,
    retry: 1,
    ...options,
  });
}

// ─── Single position query ─────────────────────────────────────────────────────

/**
 * Fetch the lending position for a specific collateral/debt pair.
 *
 * @example
 * const { data: position } = useLendingPositionQuery({
 *   collateralToken: ETH,
 *   debtToken: USDC,
 * });
 */
export function useLendingPositionQuery(
  request: LendingPositionRequest | null,
  options?: Partial<UseQueryOptions<LendingPosition>>,
) {
  const { wallet } = useZapContext();

  return useQuery<LendingPosition, Error>({
    queryKey: [
      "lending",
      "position",
      (request as { collateralToken?: Token } | null)?.collateralToken?.symbol ?? "",
      (request as { debtToken?: Token } | null)?.debtToken?.symbol ?? "",
      request?.provider ?? "default",
    ],
    queryFn: async () => {
      if (!wallet) throw new Error("Wallet not connected.");
      if (!request) throw new Error("No request provided.");
      return wallet.lending().getPosition(request);
    },
    enabled: !!wallet && !!request,
    staleTime: 30_000,
    gcTime: 60_000,
    retry: 1,
    ...options,
  });
}

// ─── Health query ──────────────────────────────────────────────────────────────

/**
 * Check whether a collateral/debt pair is above the liquidation threshold.
 * Use to show real-time health factor to the user.
 *
 * @example
 * const { data: health } = useLendingHealthQuery({ collateralToken: ETH, debtToken: USDC });
 * if (health && !health.isCollateralized) { ... }
 */
export function useLendingHealthQuery(
  request: LendingHealthRequest | null,
  options?: Partial<UseQueryOptions<LendingHealth>>,
) {
  const { wallet } = useZapContext();

  return useQuery<LendingHealth, Error>({
    queryKey: [
      "lending",
      "health",
      (request as { collateralToken?: Token } | null)?.collateralToken?.symbol ?? "",
      (request as { debtToken?: Token } | null)?.debtToken?.symbol ?? "",
      request?.provider ?? "default",
    ],
    queryFn: async () => {
      if (!wallet) throw new Error("Wallet not connected.");
      if (!request) throw new Error("No request provided.");
      return wallet.lending().getHealth(request);
    },
    enabled: !!wallet && !!request,
    staleTime: 15_000,
    gcTime: 60_000,
    retry: 1,
    ...options,
  });
}

// ─── Deposit mutation ──────────────────────────────────────────────────────────

/**
 * Supply tokens into a Vesu lending pool and earn interest.
 * Approval is included automatically by the provider.
 *
 * @example
 * const { deposit, isDepositing } = useLendingDepositMutation();
 * await deposit({ request: { token: USDC, amount: Amount.parse("1000", USDC) } });
 */
export function useLendingDepositMutation() {
  const { wallet } = useZapContext();

  const m = useMutation<Tx, Error, { request: LendingDepositRequest; options?: ExecuteOptions }>({
    mutationFn: async ({ request, options }) => {
      if (!wallet) throw new Error("Wallet not connected.");
      const tx = await wallet.lending().deposit(request, options);
      await tx.wait();
      return tx;
    },
  });

  return {
    deposit: m.mutateAsync,
    isDepositing: m.isPending,
    depositError: m.error,
    lastTx: m.data,
    reset: m.reset,
  };
}

// ─── Withdraw mutation ─────────────────────────────────────────────────────────

/**
 * Withdraw a specific amount of previously supplied tokens.
 *
 * @example
 * const { withdraw, isWithdrawing } = useLendingWithdrawMutation();
 * await withdraw({ request: { token: USDC, amount: Amount.parse("200", USDC) } });
 */
export function useLendingWithdrawMutation() {
  const { wallet } = useZapContext();

  const m = useMutation<Tx, Error, { request: LendingWithdrawRequest; options?: ExecuteOptions }>({
    mutationFn: async ({ request, options }) => {
      if (!wallet) throw new Error("Wallet not connected.");
      const tx = await wallet.lending().withdraw(request, options);
      await tx.wait();
      return tx;
    },
  });

  return {
    withdraw: m.mutateAsync,
    isWithdrawing: m.isPending,
    withdrawError: m.error,
    lastTx: m.data,
    reset: m.reset,
  };
}

// ─── Withdraw max mutation ─────────────────────────────────────────────────────

/**
 * Withdraw the maximum allowed supplied balance in one call (Vesu supports this).
 *
 * @example
 * const { withdrawMax, isWithdrawingMax } = useLendingWithdrawMaxMutation();
 * await withdrawMax({ request: { token: USDC } });
 */
export function useLendingWithdrawMaxMutation() {
  const { wallet } = useZapContext();

  const m = useMutation<
    Tx,
    Error,
    { request: LendingWithdrawMaxRequest; options?: ExecuteOptions }
  >({
    mutationFn: async ({ request, options }) => {
      if (!wallet) throw new Error("Wallet not connected.");
      const tx = await wallet.lending().withdrawMax(request, options);
      await tx.wait();
      return tx;
    },
  });

  return {
    withdrawMax: m.mutateAsync,
    isWithdrawingMax: m.isPending,
    withdrawMaxError: m.error,
    lastTx: m.data,
    reset: m.reset,
  };
}

// ─── Borrow mutation ───────────────────────────────────────────────────────────

/**
 * Borrow tokens against supplied collateral.
 * Check health before and after with `useLendingHealthQuery` to show
 * liquidation risk to users.
 *
 * @example
 * const { borrow, isBorrowing } = useBorrowMutation();
 * await borrow({
 *   request: { collateralToken: ETH, debtToken: USDC, amount: Amount.parse("500", USDC) },
 * });
 */
export function useBorrowMutation() {
  const { wallet } = useZapContext();

  const m = useMutation<Tx, Error, { request: LendingBorrowRequest; options?: ExecuteOptions }>({
    mutationFn: async ({ request, options }) => {
      if (!wallet) throw new Error("Wallet not connected.");
      const tx = await wallet.lending().borrow(request, options);
      await tx.wait();
      return tx;
    },
  });

  return {
    borrow: m.mutateAsync,
    isBorrowing: m.isPending,
    borrowError: m.error,
    lastTx: m.data,
    reset: m.reset,
  };
}

// ─── Repay mutation ────────────────────────────────────────────────────────────

/**
 * Repay borrowed debt, optionally withdrawing collateral in the same action.
 *
 * @example
 * const { repay, isRepaying } = useRepayMutation();
 * await repay({
 *   request: {
 *     collateralToken: ETH,
 *     debtToken: USDC,
 *     amount: Amount.parse("100", USDC),
 *     withdrawCollateral: true,
 *   },
 * });
 */
export function useRepayMutation() {
  const { wallet } = useZapContext();

  const m = useMutation<Tx, Error, { request: LendingRepayRequest; options?: ExecuteOptions }>({
    mutationFn: async ({ request, options }) => {
      if (!wallet) throw new Error("Wallet not connected.");
      const tx = await wallet.lending().repay(request, options);
      await tx.wait();
      return tx;
    },
  });

  return {
    repay: m.mutateAsync,
    isRepaying: m.isPending,
    repayError: m.error,
    lastTx: m.data,
    reset: m.reset,
  };
}
