import { useQuery } from "@tanstack/react-query";
import { useZapContext } from "../context";
import type { Token } from "starkzap";

/**
 * Fetches a token balance for the connected wallet.
 * Uses `wallet.balanceOf()` directly. Refreshes every 30 s while mounted.
 *
 * @example
 * const { data: balance, isLoading } = useBalance(token);
 */
export function useBalance(token: Token) {
  const { wallet } = useZapContext();

  return useQuery({
    queryKey: ["balance", token, wallet?.address],
    queryFn: () => wallet?.balanceOf(token),
    enabled: !!wallet,
    refetchInterval: 30_000,
  });
}
