"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type NetworkName = "mainnet" | "sepolia" | "devnet";

const NETWORK_META: Record<NetworkName, { label: string; color: string }> = {
  mainnet: { label: "Mainnet", color: "bg-green-500/15 text-green-700 dark:text-green-400" },
  sepolia: { label: "Sepolia", color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
  devnet: { label: "Devnet", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
};

export interface NetworkBadgeProps {
  network?: NetworkName;
  className?: string;
}

export function NetworkBadge({ network = "mainnet", className }: NetworkBadgeProps) {
  const meta = NETWORK_META[network] ?? NETWORK_META.mainnet;

  return (
    <Badge variant="outline" className={cn("text-[10px] font-medium", meta.color, className)}>
      {meta.label}
    </Badge>
  );
}
