import { useZapContext } from "../context";

/**
 * Returns the configured network name (e.g. "mainnet", "sepolia").
 *
 * @example
 * const network = useNetwork(); // "mainnet"
 */
export function useNetwork(): string {
  return useZapContext().network;
}
