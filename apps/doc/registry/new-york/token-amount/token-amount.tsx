import { cn } from "@/lib/utils";

export interface TokenAmountProps {
  /** Raw numeric amount (e.g. "1.5" or 1500000000000000000n) */
  amount: string | number | bigint;
  /** Token symbol, e.g. "STRK", "ETH" */
  symbol: string;
  /** Optional USD equivalent to display alongside */
  usdValue?: string | number | null;
  /** Decimal places to render. Default: 6 */
  decimals?: number;
  /** Hide the symbol. Default: false */
  hideSymbol?: boolean;
  className?: string;
}

function formatAmount(raw: string | number | bigint, decimals: number): string {
  const n = typeof raw === "bigint" ? Number(raw) / 1e18 : Number(raw);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/**
 * Displays a formatted token amount with optional USD equivalent.
 *
 * @example
 * ```tsx
 * <TokenAmount amount="1.5" symbol="STRK" usdValue="0.45" />
 * <TokenAmount amount={BigInt("1500000000000000000")} symbol="ETH" />
 * ```
 */
export function TokenAmount({
  amount,
  symbol,
  usdValue,
  decimals = 6,
  hideSymbol = false,
  className,
}: TokenAmountProps) {
  return (
    <span className={cn("inline-flex items-baseline gap-1 tabular-nums", className)}>
      <span className="font-medium text-foreground">{formatAmount(amount, decimals)}</span>
      {!hideSymbol && <span className="text-xs text-muted-foreground font-mono">{symbol}</span>}
      {usdValue != null && (
        <span className="text-xs text-muted-foreground/70">≈ ${Number(usdValue).toFixed(2)}</span>
      )}
    </span>
  );
}
