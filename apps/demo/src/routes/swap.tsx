import { useState, useMemo, useEffect } from "react";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  useGetQuoteQuery,
  useSwapMutation,
  usePresetTokens,
  useWallet,
  useBalance,
  useNetwork,
  Amount,
} from "@dngbuilds/zapkit-react";
import type { Token, SwapQuote } from "@dngbuilds/zapkit-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { TokenSelector } from "@/components/token-selector";

export const Route = createFileRoute("/swap")({
  component: SwapPage,
});

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── Provider meta + helpers ────────────────────────────────────────────────────────
const PROVIDER_NAME: Record<string, string> = { avnu: "AVNU", ekubo: "Ekubo" };
const PROVIDER_DESC: Record<string, string> = {
  avnu: "DEX aggregator",
  ekubo: "Concentrated liquidity",
};

function formatOut(quote: SwapQuote | undefined, tokenOut: Token): string {
  if (!quote) return "—";
  try {
    const dec = tokenOut.decimals;
    const base = quote.amountOutBase;
    const divisor = BigInt(10 ** dec);
    const whole = base / divisor;
    const frac = (base % divisor).toString().padStart(dec, "0").slice(0, 6).replace(/0+$/, "");
    return frac ? `${whole}.${frac}` : `${whole}`;
  } catch {
    return "—";
  }
}

interface TokenPanelProps {
  label: string;
  walletAddress: string | null;
  tokens: Token[];
  selectedToken: Token;
  onTokenChange: (t: Token) => void;
  amount: string;
  onAmountChange?: (v: string) => void;
  readonly?: boolean;
  estimatedLabel?: string;
}

function TokenPanel({
  label,
  walletAddress,
  tokens,
  selectedToken,
  onTokenChange,
  amount,
  onAmountChange,
  readonly = false,
  estimatedLabel,
}: TokenPanelProps) {
  // Live balance for the selected token
  const { data: balance, isLoading: balanceLoading } = useBalance(selectedToken);
  const balanceStr = balanceLoading
    ? "…"
    : balance
      ? Number(balance.toUnit()).toLocaleString(undefined, { maximumFractionDigits: 6 })
      : "0";

  return (
    <div className="rounded-xl border bg-muted/30 p-4 flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">{label}</span>
        {walletAddress && (
          <div className="flex items-center gap-1.5">
            <span>🦊</span>
            <span className="font-mono">{shortenAddress(walletAddress)}</span>
            <span className="ml-1">💼 {balanceStr}</span>
          </div>
        )}
      </div>

      {/* Token + amount row */}
      <div className="flex items-center gap-3">
        <TokenSelector tokens={tokens} selected={selectedToken} onChange={onTokenChange} />

        <div className="flex-1 flex flex-col items-end">
          <Input
            className={cn(
              "text-right text-xl font-semibold border-0 bg-transparent shadow-none p-0 h-auto focus-visible:ring-0",
              readonly && "text-muted-foreground",
            )}
            placeholder="0.00"
            value={amount}
            onChange={(e) => onAmountChange?.(e.target.value)}
            readOnly={readonly}
            inputMode="decimal"
          />
          <span className="text-xs text-muted-foreground">{estimatedLabel ?? "~0 USD"}</span>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        <Badge variant="outline" className="text-[10px]">
          Starknet
        </Badge>
      </div>
    </div>
  );
}

// ─── Provider Quote Card ─────────────────────────────────────────────────────

interface ProviderQuoteCardProps {
  providerId: string;
  quote: SwapQuote | undefined;
  isLoading: boolean;
  hasError: boolean;
  isBest: boolean;
  isSelected: boolean;
  tokenOut: Token;
  /** When true, show compact row with a chevron; user can expand to see details */
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelect: () => void;
}

function ProviderQuoteCard({
  providerId,
  quote,
  isLoading,
  hasError,
  isBest,
  isSelected,
  tokenOut,
  collapsed,
  onToggleCollapse,
  onSelect,
}: ProviderQuoteCardProps) {
  const label = PROVIDER_NAME[providerId] ?? providerId;
  const desc = PROVIDER_DESC[providerId] ?? "";

  if (collapsed) {
    return (
      <button
        type="button"
        className="w-full text-left rounded-lg border border-border bg-muted/20 px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-muted/40 transition-colors"
        onClick={onToggleCollapse}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">{desc}</span>
          {isBest && (
            <Badge className="text-[10px] h-4 px-1.5 bg-green-500/15 text-green-700 border-green-400/30 pointer-events-none">
              Best
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isLoading ? (
            <Spinner className="h-3 w-3" />
          ) : quote ? (
            <span className="text-sm font-mono text-muted-foreground">
              {formatOut(quote, tokenOut)} {tokenOut.symbol}
            </span>
          ) : hasError ? (
            <span className="text-xs text-destructive">Unavailable</span>
          ) : null}
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            strokeWidth={2}
            className="h-4 w-4 text-muted-foreground"
          />
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-xl border-2 p-4 flex flex-col gap-3 transition-all ${
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card hover:border-primary/40"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-[11px] text-primary-foreground font-bold">
            {label.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm">{label}</span>
              {isBest && (
                <Badge className="text-[10px] h-4 px-1.5 bg-green-500/15 text-green-700 border-green-400/30 pointer-events-none">
                  Best rate
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">{desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isSelected && !isLoading && (
            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
              <svg
                className="h-3 w-3 text-primary-foreground"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 011.414-1.414L8.414 12.172l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          )}
          <button
            type="button"
            className="p-0.5 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
          >
            <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="rounded-lg bg-muted/50 p-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-3 w-3" />
          Fetching quote…
        </div>
      ) : hasError ? (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          Quote unavailable for this pair
        </div>
      ) : quote ? (
        <div className="rounded-lg bg-muted/40 p-3 flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Receive</span>
            <span className="font-mono font-semibold">
              {formatOut(quote, tokenOut)} {tokenOut.symbol}
            </span>
          </div>
          {quote.priceImpactBps != null && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Price impact</span>
              <span
                className={`font-mono text-xs ${
                  Number(quote.priceImpactBps) > 100 ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {(Number(quote.priceImpactBps) / 100).toFixed(2)}%
              </span>
            </div>
          )}
          {quote.routeCallCount != null && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Route hops</span>
              <span className="font-mono text-xs text-muted-foreground">
                {quote.routeCallCount}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Slippage</span>
            <span className="font-mono text-xs text-muted-foreground">0.5%</span>
          </div>
        </div>
      ) : null}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function SwapPage() {
  const { status, wallet } = useWallet();
  const isConnected = status === "connected";
  const walletAddress = wallet ? String(wallet.address) : null;

  // ── Tokens ────────────────────────────────────────────────────────────────
  const tokensMap = usePresetTokens();
  const tokensArray = useMemo(() => Object.values(tokensMap), [tokensMap]);

  const [tokenIn, setTokenIn] = useState<Token>(() => tokensMap.USDT ?? tokensArray[0]);
  const [tokenOut, setTokenOut] = useState<Token>(
    () => tokensMap.STRK ?? tokensMap.ETH ?? tokensArray[1],
  );
  const [amountIn, setAmountIn] = useState("");
  //   const [mevProtect, setMevProtect] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>("avnu");
  const [altExpanded, setAltExpanded] = useState(false);

  // ── Debounce raw input — queries only fire 500 ms after the user stops typing
  const [debouncedAmountIn] = useDebouncedValue(amountIn, { wait: 500 });

  // ── Balance of tokenIn in the connected wallet ────────────────────────────
  const { data: tokenInBalance } = useBalance(tokenIn);
  const insufficientBalance = useMemo(() => {
    if (!debouncedAmountIn || Number(debouncedAmountIn) <= 0) return false;
    if (!tokenInBalance) return false; // balance not loaded yet — don't block
    return Number(tokenInBalance.toUnit()) < Number(debouncedAmountIn);
  }, [tokenInBalance, debouncedAmountIn]);

  // ── Parse amountIn for query — only when valid ──────────────────────────────
  const parsedAmountIn = useMemo(() => {
    if (!debouncedAmountIn || Number(debouncedAmountIn) <= 0) return null;
    if (insufficientBalance) return null;
    try {
      return Amount.parse(debouncedAmountIn, tokenIn);
    } catch {
      return null;
    }
  }, [debouncedAmountIn, tokenIn, insufficientBalance]);

  const queryEnabled = isConnected && !!parsedAmountIn;

  // AVNU on Sepolia internally routes through Ekubo contracts (0x4270…0f) which
  // are NOT deployed on Sepolia — both providers fail at the execution step.
  // Disable all quote queries and the swap button on non-mainnet to prevent
  // users from hitting that error.
  const network = useNetwork();
  const isMainnet = network === "mainnet";

  // ── Two reactive queries — fire in parallel when inputs are ready ───────────
  const avnuQ = useGetQuoteQuery(
    parsedAmountIn
      ? { tokenIn, tokenOut, amountIn: parsedAmountIn, slippageBps: 50n, provider: "avnu" }
      : null,
    // Disable on non-mainnet: AVNU Sepolia quotes build calls via Ekubo which isn't deployed
    { enabled: queryEnabled && isMainnet, staleTime: 0 },
  );
  const ekuboQ = useGetQuoteQuery(
    parsedAmountIn
      ? { tokenIn, tokenOut, amountIn: parsedAmountIn, slippageBps: 50n, provider: "ekubo" }
      : null,
    // Ekubo router 0x04270…0f is not deployed on Sepolia
    { enabled: queryEnabled && isMainnet, staleTime: 0 },
  );

  // ── Swap mutation ────────────────────────────────────────────────────────────
  const { swap, isSwapping, swapError, reset: resetSwap } = useSwapMutation();

  // ── Best provider = higher amountOutBase ─────────────────────────────────────
  const bestProvider = useMemo(() => {
    if (!avnuQ.data && !ekuboQ.data) return null;
    if (!avnuQ.data) return "ekubo";
    if (!ekuboQ.data) return "avnu";
    return avnuQ.data.amountOutBase >= ekuboQ.data.amountOutBase ? "avnu" : "ekubo";
  }, [avnuQ.data, ekuboQ.data]);

  // Auto-select best when quotes arrive
  useEffect(() => {
    if (bestProvider) setSelectedProvider(bestProvider);
  }, [bestProvider]);

  // Collapse alt card when inputs change
  useEffect(() => {
    setAltExpanded(false);
  }, [tokenIn.symbol, tokenOut.symbol, amountIn]);

  // ── Derived display ──────────────────────────────────────────────────────────
  const selectedQuoteData = selectedProvider === "avnu" ? avnuQ.data : ekuboQ.data;
  const estimatedOut = useMemo(
    () => formatOut(selectedQuoteData, tokenOut),
    [selectedQuoteData, tokenOut],
  );

  const isQuoting = avnuQ.isFetching || ekuboQ.isFetching;
  const hasAnyQuote = !!(avnuQ.data || ekuboQ.data);
  const allQuotesFailed =
    queryEnabled && !isQuoting && !hasAnyQuote && !!(avnuQ.error && ekuboQ.error);

  function retryQuotes() {
    void avnuQ.refetch();
    void ekuboQ.refetch();
  }

  const altProvider = selectedProvider === "avnu" ? "ekubo" : "avnu";
  const bestQ = selectedProvider === "avnu" ? avnuQ : ekuboQ;
  const altQ = altProvider === "avnu" ? avnuQ : ekuboQ;
  const showQuotes = queryEnabled && (isQuoting || hasAnyQuote);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function flipTokens() {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn(estimatedOut === "—" ? "" : estimatedOut);
    resetSwap();
  }

  async function handleSwap() {
    if (!isConnected || !walletAddress || !parsedAmountIn) return;
    try {
      const tx = await swap({
        request: {
          tokenIn,
          tokenOut,
          amountIn: parsedAmountIn,
          slippageBps: 50n,
          provider: selectedProvider,
        } as Parameters<typeof swap>[0]["request"],
        // SNIP-9 sponsored execution is not supported on all accounts;
        // user_pays uses the standard fee payment flow.
        options: { feeMode: "user_pays" },
      });
      toast.success("Swap submitted!", {
        description: `Tx: ${String((tx as { hash?: string }).hash ?? "").slice(0, 12)}…`,
      });
      setAmountIn("");
      resetSwap();
    } catch (err) {
      toast.error("Swap failed", { description: (err as Error)?.message });
    }
  }

  const parsedIn = Number(amountIn);
  const isValidAmount = amountIn !== "" && !Number.isNaN(parsedIn) && parsedIn > 0;
  const canSwap =
    isConnected &&
    isMainnet &&
    isValidAmount &&
    !insufficientBalance &&
    hasAnyQuote &&
    !isSwapping &&
    !isQuoting;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto">
      {" "}
      {/* ─── Sepolia warning ─── */}
      {!isMainnet && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <span className="font-semibold">Swap is only available on Starknet Mainnet.</span> Both
          AVNU and Ekubo route through Ekubo liquidity contracts that are not deployed on Sepolia
          testnet. Switch your wallet to mainnet to swap.
        </div>
      )}{" "}
      {/* ─── Token panels ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Swap</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {/* From */}
          <TokenPanel
            label="From:"
            walletAddress={walletAddress}
            tokens={tokensArray}
            selectedToken={tokenIn}
            onTokenChange={(t) => {
              if (t.symbol === tokenOut.symbol) setTokenOut(tokenIn);
              setTokenIn(t);
              resetSwap();
            }}
            amount={amountIn}
            onAmountChange={(v) => {
              setAmountIn(v);
              resetSwap();
            }}
          />

          {/* Flip */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 rounded-full p-0"
              onClick={flipTokens}
              title="Flip tokens"
            >
              ↕
            </Button>
          </div>

          {/* To — shows selected provider's estimate */}
          <TokenPanel
            label="To:"
            walletAddress={walletAddress}
            tokens={tokensArray}
            selectedToken={tokenOut}
            onTokenChange={(t) => {
              if (t.symbol === tokenIn.symbol) setTokenIn(tokenOut);
              setTokenOut(t);
              resetSwap();
            }}
            amount={isQuoting ? "…" : estimatedOut === "—" ? "" : estimatedOut}
            readonly
            estimatedLabel={
              selectedQuoteData
                ? `via ${PROVIDER_NAME[selectedProvider] ?? selectedProvider}`
                : "~0 USD"
            }
          />
        </CardContent>
      </Card>
      {/* ─── Settings + routes + swap ─── */}
      <Card>
        <CardContent className="pt-4 flex flex-col gap-4">
          {/* Amount input — queries fire automatically on change */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Amount</Label>
            <Input
              placeholder="0.00 — quotes update automatically"
              value={amountIn}
              onChange={(e) => {
                setAmountIn(e.target.value);
                resetSwap();
              }}
              inputMode="decimal"
            />
            {insufficientBalance && (
              <p className="text-xs text-destructive">Insufficient {tokenIn.symbol} balance</p>
            )}
            {!insufficientBalance && amountIn !== debouncedAmountIn && (
              <p className="text-xs text-muted-foreground">Waiting to fetch quote…</p>
            )}
            {!insufficientBalance && isQuoting && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Spinner className="h-3 w-3" />
                Comparing AVNU and Ekubo…
              </p>
            )}
            {allQuotesFailed && (
              <div className="flex items-center justify-between rounded-md bg-destructive/10 px-3 py-2">
                <p className="text-xs text-destructive">
                  Both AVNU and Ekubo returned no quote for this pair.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={retryQuotes}
                >
                  Retry
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* MEV Protect */}
          {/* <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <span>🛡</span>
              <Label htmlFor="mev-protect" className="cursor-pointer text-sm">
                MEV Protect
              </Label>
            </div>
            <Switch id="mev-protect" checked={mevProtect} onCheckedChange={setMevProtect} />
          </div> */}

          {/* ─── Provider route comparison / error ─── */}
          {allQuotesFailed && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex flex-col gap-2">
              <p className="text-sm font-medium text-destructive">No quotes available</p>
              <p className="text-xs text-muted-foreground">
                Neither AVNU nor Ekubo could price this swap. Try a different token pair, a smaller
                amount, or check your network connection.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-fit"
                onClick={retryQuotes}
              >
                <Spinner className={cn("h-3 w-3 mr-1.5", isQuoting ? "animate-spin" : "hidden")} />
                Try again
              </Button>
            </div>
          )}
          {showQuotes && (
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Choose route
              </Label>

              {/* Selected / best — always expanded */}
              <ProviderQuoteCard
                providerId={selectedProvider}
                quote={bestQ.data}
                isLoading={bestQ.isFetching}
                hasError={!!bestQ.error}
                isBest={bestProvider === selectedProvider}
                isSelected
                tokenOut={tokenOut}
                collapsed={false}
                onToggleCollapse={() => {
                  setSelectedProvider(altProvider);
                  setAltExpanded(false);
                }}
                onSelect={() => {}}
              />

              {/* Alt provider — only visible on mainnet where Ekubo is deployed */}
              {isMainnet && (
                <ProviderQuoteCard
                  providerId={altProvider}
                  quote={altQ.data}
                  isLoading={altQ.isFetching}
                  hasError={!!altQ.error}
                  isBest={bestProvider === altProvider}
                  isSelected={false}
                  tokenOut={tokenOut}
                  collapsed={!altExpanded}
                  onToggleCollapse={() => setAltExpanded((p) => !p)}
                  onSelect={() => {
                    setSelectedProvider(altProvider);
                    setAltExpanded(false);
                  }}
                />
              )}
            </div>
          )}

          {swapError && <p className="text-sm text-destructive">{swapError.message}</p>}

          {/* Swap button */}
          <Button className="w-full" size="lg" disabled={!canSwap} onClick={handleSwap}>
            {isSwapping ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Swapping…
              </>
            ) : !isMainnet ? (
              "Swap unavailable on Sepolia"
            ) : !isConnected ? (
              "Connect wallet to swap"
            ) : !isValidAmount ? (
              "Enter an amount"
            ) : insufficientBalance ? (
              `Insufficient ${tokenIn.symbol} balance`
            ) : isQuoting ? (
              "Getting quotes…"
            ) : allQuotesFailed ? (
              "No quotes available — try again"
            ) : !hasAnyQuote ? (
              "Waiting for quote…"
            ) : (
              `Swap ${tokenIn.symbol} → ${tokenOut.symbol} via ${
                PROVIDER_NAME[selectedProvider] ?? selectedProvider
              }`
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
