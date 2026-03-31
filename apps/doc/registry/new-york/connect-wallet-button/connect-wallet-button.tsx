"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type WalletConnectionStatus = "idle" | "connecting" | "connected" | "error";

export interface ConnectWalletButtonProps {
  /** Current wallet connection status */
  status?: WalletConnectionStatus;
  /** Connected wallet address (shown truncated when connected) */
  address?: string | null;
  /** Resolved ENS / StarkNet ID — shown instead of address when available */
  ens?: string | null;
  /** Called when user clicks Connect */
  onConnect?: () => void;
  /** Called when user clicks Disconnect (only visible when connected) */
  onDisconnect?: () => void;
  /** Extra Tailwind classes */
  className?: string;
}

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * A single smart button for wallet connect / disconnect.
 * Wire it up with `useWallet()` from `@dngbuilds/zapkit-react`:
 *
 * @example
 * ```tsx
 * import { useWallet } from "@dngbuilds/zapkit-react";
 * import { ConnectWalletButton } from "@/components/connect-wallet-button";
 *
 * const { address, status, connect, disconnect } = useWallet();
 * <ConnectWalletButton
 *   status={status}
 *   address={address}
 *   onConnect={connect}
 *   onDisconnect={disconnect}
 * />
 * ```
 */
export function ConnectWalletButton({
  status = "idle",
  address,
  ens,
  onConnect,
  onDisconnect,
  className,
}: ConnectWalletButtonProps) {
  const isConnected = status === "connected" && !!address;
  const isConnecting = status === "connecting";

  if (isConnected) {
    const display = ens ?? truncate(address!);
    return (
      <Button variant="outline" onClick={onDisconnect} className={cn("", className)}>
        <span aria-hidden className="size-2 rounded-full bg-emerald-500 shrink-0" />
        {display}
      </Button>
    );
  }

  return (
    <Button
      variant="default"
      disabled={isConnecting}
      onClick={onConnect}
      className={cn("gap-2", className)}
    >
      {isConnecting && <Spinner className="size-3.5" data-icon="inline-start" />}
      {isConnecting ? "Connecting…" : "Connect Wallet"}
    </Button>
  );
}
