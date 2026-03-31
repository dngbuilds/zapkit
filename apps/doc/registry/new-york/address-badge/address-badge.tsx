"use client";

import { useState, useCallback } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface AddressBadgeProps {
  /** Full Starknet address (0x…) */
  address: string;
  /** Resolved ENS / StarkNet ID displayed in place of the address */
  ens?: string | null;
  /** How many chars to keep at start/end when truncating. Defaults: 6/4 */
  truncate?: { start?: number; end?: number };
  /** Show a copy-to-clipboard action. Default: true */
  showCopy?: boolean;
  className?: string;
}

function truncateAddr(address: string, start = 6, end = 4): string {
  if (address.length <= start + end + 3) return address;
  return `${address.slice(0, start)}…${address.slice(-end)}`;
}

/**
 * Inline address badge with tooltip (full address) and copy-on-click.
 *
 * @example
 * ```tsx
 * <AddressBadge address="0x049d36570d4e46f48e99674…" />
 * <AddressBadge address="0x049d…" ens="vitalik.stark" />
 * ```
 */
export function AddressBadge({
  address,
  ens,
  truncate: t,
  showCopy = true,
  className,
}: AddressBadgeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!showCopy) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard not available */
    }
  }, [address, showCopy]);

  const display = ens ?? truncateAddr(address, t?.start, t?.end);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={`Wallet address: ${address}. Click to copy.`}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 font-mono text-xs transition-colors hover:bg-muted",
              className,
            )}
          >
            <span aria-hidden className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
            {display}
            {copied && (
              <span className="text-emerald-500 text-xs" aria-live="polite">
                ✓
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="font-mono text-xs">
          {ens && <p className="text-muted-foreground mb-0.5">{ens}</p>}
          <p className="break-all">{address}</p>
          {showCopy && <p className="mt-0.5 text-muted-foreground/70 text-[10px]">Click to copy</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
