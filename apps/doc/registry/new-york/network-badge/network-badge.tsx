"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type NetworkName = "mainnet" | "sepolia" | "devnet" | "goerli" | (string & {});

const NETWORK_LABELS: Record<string, string> = {
  mainnet: "Mainnet",
  sepolia: "Sepolia",
  devnet: "Devnet",
  goerli: "Goerli",
};

const NETWORK_CLASSES: Record<string, string> = {
  mainnet: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  sepolia: "border-violet-500/30 bg-violet-500/10 text-violet-400",
  devnet: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  goerli: "border-sky-500/30 bg-sky-500/10 text-sky-400",
};

export interface NetworkBadgeProps {
  /** Starknet network identifier */
  network: NetworkName;
  className?: string;
}

/**
 * Small colored badge indicating the connected Starknet network.
 *
 * @example
 * ```tsx
 * <NetworkBadge network="mainnet" />
 * <NetworkBadge network="sepolia" />
 * ```
 */
export function NetworkBadge({ network, className }: NetworkBadgeProps) {
  const label = NETWORK_LABELS[network] ?? network;
  const colorClass = NETWORK_CLASSES[network] ?? "border-zinc-500/30 bg-zinc-500/10 text-zinc-400";

  return (
    <Badge variant="outline" className={cn("gap-1 capitalize", colorClass, className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current shrink-0" />
      {label}
    </Badge>
  );
}
