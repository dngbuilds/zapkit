"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useCallback, useState } from "react";

export interface AddressBadgeProps {
  address: string;
  ens?: string | null;
  className?: string;
}

function truncate(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function AddressBadge({ address, ens, className }: AddressBadgeProps) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [address]);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={copy}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs transition-colors hover:bg-accent cursor-pointer select-none",
              className,
            )}
          >
            {ens ?? truncate(address)}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="font-mono text-xs">
          {copied ? "Copied!" : address}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
