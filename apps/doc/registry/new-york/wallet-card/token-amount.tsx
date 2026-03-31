"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface TokenAmountProps {
  /** Raw or pre-formatted token amount */
  amount: string;
  /** Token symbol, e.g. "ETH" */
  symbol: string;
  /** Optional USD value string */
  usdValue?: string | null;
  /** Max decimal places to display (default 6) */
  decimals?: number;
  /** Hide the symbol suffix */
  hideSymbol?: boolean;
  className?: string;
}

function formatAmount(raw: string, decimals: number): string {
  const n = Number(raw);
  if (Number.isNaN(n)) return raw;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function TokenAmount({
  amount,
  symbol,
  usdValue,
  decimals = 6,
  hideSymbol = false,
  className,
}: TokenAmountProps) {
  const display = `${formatAmount(amount, decimals)}${hideSymbol ? "" : ` ${symbol}`}`;

  if (!usdValue) {
    return <span className={cn("tabular-nums text-sm font-medium", className)}>{display}</span>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("tabular-nums text-sm font-medium cursor-default", className)}>
            {display}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          ≈ ${usdValue}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
