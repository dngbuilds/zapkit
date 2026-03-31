import { useZapContext } from "../context";

/**
 * Returns the starkzap Wallet instance and connection state/actions.
 *
 * The `wallet` is the real starkzap `Wallet` — you can call all wallet
 * methods directly (staking, swaps, lending, bridging, etc).
 *
 * @example
 * const { wallet, status, connectCartridge, disconnect } = useWallet();
 * // wallet.stake(poolAddress, amount)
 * // wallet.swap(...)
 * // wallet.lending().deposit(...)
 */
export function useWallet() {
  const ctx = useZapContext();

  return {
    /** The connected starkzap Wallet — null until connected. */
    wallet: ctx.wallet,
    /** Connection status: "idle" | "connecting" | "connected" | "error" */
    status: ctx.status,
    /** True while a connect/disconnect is in progress */
    isLoading: ctx.isLoading,
    /** The last connection error, if any */
    error: ctx.error,
    /** Connect with a StarkSigner (private key) */
    connectSigner: ctx.connectSigner,
    /** Connect with Privy (social login) */
    connectPrivy: ctx.connectPrivy,
    /** Connect with Cartridge Controller (passkeys) */
    connectCartridge: ctx.connectCartridge,
    /** Disconnect the current wallet */
    disconnect: ctx.disconnect,
  };
}
