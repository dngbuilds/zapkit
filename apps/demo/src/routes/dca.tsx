import { useState, useMemo, useEffect, Fragment } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useDebouncedValue } from "@tanstack/react-pacer";
import {
  useDcaOrdersQuery,
  useCreateDcaMutation,
  useCancelDcaMutation,
  usePreviewDcaCycleMutation,
  usePresetTokens,
  useWallet,
  useBalance,
  useNetwork,
  Amount,
} from "@dngbuilds/zapkit-react";
import type { Token, DcaOrder, DcaTrade, DcaCreateInput } from "@dngbuilds/zapkit-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  PlusSignIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { TokenSelector } from "@/components/token-selector";

export const Route = createFileRoute("/dca")({
  component: DcaPage,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FREQUENCY_OPTIONS = [
  { label: "Hourly", value: "PT1H" },
  { label: "Every 4 hours", value: "PT4H" },
  { label: "Every 12 hours", value: "PT12H" },
  { label: "Daily", value: "P1D" },
  { label: "Weekly", value: "P1W" },
];

function formatFrequency(f: string): string {
  return FREQUENCY_OPTIONS.find((o) => o.value === f)?.label ?? f;
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatBaseAmount(base: bigint, decimals: number, maxFrac = 4): string {
  if (base === 0n) return "0";
  const divisor = BigInt(10 ** decimals);
  const whole = base / divisor;
  const frac = (base % divisor)
    .toString()
    .padStart(decimals, "0")
    .slice(0, maxFrac)
    .replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

function shortenAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-500/15 text-green-700 border-green-400/30",
  INDEXING: "bg-yellow-500/15 text-yellow-700 border-yellow-400/30",
  CLOSED: "bg-muted text-muted-foreground border-border",
};

// ─── Create DCA Order Dialog ───────────────────────────────────────────────────

interface CreateDcaDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tokens: Token[];
  onCreated: () => void;
}

function CreateDcaDialog({ open, onOpenChange, tokens, onCreated }: CreateDcaDialogProps) {
  // Ekubo TWAMM is only deployed on mainnet
  const network = useNetwork();
  const isMainnet = network === "mainnet";

  const [sellToken, setSellToken] = useState<Token | null>(null);
  const [buyToken, setBuyToken] = useState<Token | null>(null);
  const [totalAmount, setTotalAmount] = useState("");
  const [perCycleAmount, setPerCycleAmount] = useState("");
  const [frequency, setFrequency] = useState("P1D");
  const [provider, setProvider] = useState("avnu");

  const [debouncedPerCycle] = useDebouncedValue(perCycleAmount, { wait: 400 });

  const { data: balance, isLoading: balanceLoading } = useBalance(sellToken ?? tokens[0]);
  const { createOrder, isCreating, createError, reset } = useCreateDcaMutation();
  const { previewCycle, isPreviewing, preview, previewError } = usePreviewDcaCycleMutation();

  // Balance guard
  const insufficientBalance = useMemo(() => {
    if (!totalAmount || !balance || !sellToken) return false;
    return Number(balance.toUnit()) < Number(totalAmount);
  }, [balance, totalAmount, sellToken]);

  const balanceStr = balanceLoading
    ? "…"
    : balance
      ? Number(balance.toUnit()).toLocaleString(undefined, { maximumFractionDigits: 6 })
      : "0";

  // Auto-preview when perCycle + tokens are ready
  const canPreview = !!(
    sellToken &&
    buyToken &&
    debouncedPerCycle &&
    Number(debouncedPerCycle) > 0
  );

  // Trigger preview whenever debounced amount or tokens change.
  // Must be useEffect (not useMemo) as this is a side effect.
  useEffect(() => {
    if (!canPreview || !sellToken || !buyToken) return;
    try {
      const amt = Amount.parse(debouncedPerCycle, sellToken);
      previewCycle({ sellToken, buyToken, sellAmountPerCycle: amt }).catch(() => {});
    } catch (e) {
      // ignore — previewError state drives UI
      void e;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedPerCycle, sellToken?.symbol, buyToken?.symbol]);

  function handleClose() {
    setSellToken(null);
    setBuyToken(null);
    setTotalAmount("");
    setPerCycleAmount("");
    setFrequency("P1D");
    reset();
    onOpenChange(false);
  }

  async function handleCreate() {
    if (!sellToken || !buyToken || !totalAmount || !perCycleAmount) return;
    try {
      const request: DcaCreateInput = {
        sellToken,
        buyToken,
        sellAmount: Amount.parse(totalAmount, sellToken),
        sellAmountPerCycle: Amount.parse(perCycleAmount, sellToken),
        frequency,
        provider,
      };
      await createOrder({ request, options: { feeMode: "user_pays" } });
      toast.success("DCA order created!", {
        description: `Buying ${buyToken.symbol} with ${perCycleAmount} ${sellToken.symbol} per cycle`,
      });
      onCreated();
      handleClose();
    } catch (err) {
      toast.error("Failed to create order", { description: (err as Error)?.message });
    }
  }

  const canCreate =
    !!sellToken &&
    !!buyToken &&
    sellToken.symbol !== buyToken.symbol &&
    Number(totalAmount) > 0 &&
    Number(perCycleAmount) > 0 &&
    Number(perCycleAmount) <= Number(totalAmount) &&
    !insufficientBalance &&
    !isCreating;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create DCA Order</DialogTitle>
          <DialogDescription>
            Schedule recurring buys. The sell token will be converted to the buy token on each
            cycle.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Provider */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Provider</Label>
            <Select value={provider} onValueChange={(v) => v && setProvider(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="avnu">AVNU — Recurring orders</SelectItem>
                {/* Ekubo TWAMM contract is only deployed on mainnet */}
                {isMainnet && <SelectItem value="ekubo">Ekubo — TWAMM continuous</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {/* Token pair */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Token pair</Label>
            <div className="flex items-center gap-2">
              <TokenSelector
                tokens={tokens}
                selected={sellToken}
                onChange={setSellToken}
                placeholder="Sell"
              />
              <span className="text-muted-foreground text-sm font-medium">→</span>
              <TokenSelector
                tokens={tokens}
                selected={buyToken}
                onChange={setBuyToken}
                placeholder="Buy"
              />
            </div>
            {sellToken === buyToken && sellToken && (
              <p className="text-xs text-destructive">Sell and buy tokens must be different</p>
            )}
          </div>

          {/* Total sell amount */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Total sell amount</Label>
              {sellToken && (
                <span className="text-xs text-muted-foreground">
                  Balance: {balanceStr} {sellToken.symbol}
                </span>
              )}
            </div>
            <Input
              placeholder="0.00"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              inputMode="decimal"
            />
            {insufficientBalance && (
              <p className="text-xs text-destructive">Insufficient {sellToken?.symbol} balance</p>
            )}
          </div>

          {/* Per-cycle amount */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Sell amount per cycle</Label>
            <Input
              placeholder="0.00"
              value={perCycleAmount}
              onChange={(e) => setPerCycleAmount(e.target.value)}
              inputMode="decimal"
            />
            {Number(perCycleAmount) > Number(totalAmount) && Number(totalAmount) > 0 && (
              <p className="text-xs text-destructive">
                Per-cycle amount cannot exceed total amount
              </p>
            )}
          </div>

          {/* Frequency */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm">Frequency</Label>
            <Select value={frequency} onValueChange={(v) => v && setFrequency(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cycle preview */}
          {canPreview && (
            <div className="rounded-lg bg-muted/40 p-3 flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Estimated per cycle
              </p>
              {isPreviewing ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="h-3 w-3" />
                  Fetching preview…
                </div>
              ) : previewError ? (
                <p className="text-sm text-destructive">Preview unavailable</p>
              ) : preview ? (
                <p className="text-sm font-mono font-semibold">
                  ≈ {buyToken ? formatBaseAmount(preview.amountOutBase, buyToken.decimals) : "—"}{" "}
                  {buyToken?.symbol}
                </p>
              ) : null}
            </div>
          )}

          {createError && <p className="text-sm text-destructive">{createError.message}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canCreate}>
            {isCreating ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Creating…
              </>
            ) : (
              "Create Order"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── DCA Page ─────────────────────────────────────────────────────────────────

function DcaPage() {
  const { status } = useWallet();
  const isConnected = status === "connected";
  const qc = useQueryClient();

  const tokensMap = usePresetTokens();
  const tokensArray = useMemo(() => Object.values(tokensMap), [tokensMap]);

  const [showCreate, setShowCreate] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "CLOSED" | "">("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const {
    data: ordersPage,
    isLoading,
    isFetching,
    error: ordersError,
    refetch,
  } = useDcaOrdersQuery(statusFilter ? { status: statusFilter } : {}, { enabled: isConnected });

  const { cancelOrder } = useCancelDcaMutation();

  const orders = ordersPage?.content ?? [];

  async function handleCancel(order: DcaOrder) {
    setCancellingId(order.id);
    try {
      await cancelOrder({
        request: {
          orderId: order.id,
          orderAddress: order.orderAddress,
          provider: order.providerId,
        },
        options: { feeMode: "user_pays" },
      });
      toast.success("Order cancelled");
      await refetch();
    } catch (err) {
      toast.error("Cancel failed", { description: (err as Error)?.message });
    } finally {
      setCancellingId(null);
    }
  }

  function handleCreated() {
    // Invalidate the orders query so the table refreshes
    void qc.invalidateQueries({ queryKey: ["dca", "orders"] });
  }

  // Find matching token from preset map (address-keyed)
  function tokenByAddr(addr: string): Token | undefined {
    return tokensArray.find((t) => t.address?.toLowerCase() === addr?.toLowerCase());
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        {isConnected && (
          <div className="flex items-center gap-1.5">
            {(["", "ACTIVE", "CLOSED"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors",
                  statusFilter === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-muted/50",
                )}
              >
                {s === "" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <HugeiconsIcon
              icon={RefreshIcon}
              strokeWidth={2}
              className={cn("h-4 w-4", isFetching && "animate-spin")}
            />
          </Button>
          <Button onClick={() => setShowCreate(true)} disabled={!isConnected} size="sm">
            <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} className="mr-1.5 h-4 w-4" />
            Create Order
          </Button>
        </div>
      </div>

      {!isConnected && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-3/4" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Orders table ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            Orders
            {ordersPage && (
              <Badge variant="outline" className="text-[10px]">
                {ordersPage.totalElements}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-10 gap-2 text-muted-foreground text-sm">
              <Spinner className="h-4 w-4" />
              Loading orders…
            </div>
          ) : ordersError ? (
            <div className="p-6 text-sm text-destructive">
              Failed to load orders: {ordersError.message}
            </div>
          ) : orders.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No DCA orders found.{" "}
              {isConnected && (
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-foreground transition-colors"
                  onClick={() => setShowCreate(true)}
                >
                  Create one
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Pair</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">Bought</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const sellTok = tokenByAddr(order.sellTokenAddress);
                    const buyTok = tokenByAddr(order.buyTokenAddress);
                    const isCancelling = cancellingId === order.id;
                    const isExpanded = expandedIds.has(order.id);
                    return (
                      <Fragment key={order.id}>
                        <TableRow>
                          <TableCell className="w-8 p-2">
                            {order.trades.length > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleExpanded(order.id)}
                                className="flex items-center justify-center h-5 w-5 rounded hover:bg-muted/70 transition-colors"
                                aria-label={isExpanded ? "Collapse trades" : "Expand trades"}
                              >
                                <HugeiconsIcon
                                  icon={isExpanded ? ArrowUp01Icon : ArrowDown01Icon}
                                  strokeWidth={2}
                                  className="h-3.5 w-3.5 text-muted-foreground"
                                />
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5">
                              {sellTok?.metadata?.logoUrl && (
                                <img
                                  src={sellTok.metadata.logoUrl.toString()}
                                  className="h-5 w-5 rounded-full"
                                  alt={sellTok.symbol}
                                />
                              )}
                              <span>{sellTok?.symbol ?? shortenAddr(order.sellTokenAddress)}</span>
                              <span className="text-muted-foreground">→</span>
                              {buyTok?.metadata?.logoUrl && (
                                <img
                                  src={buyTok.metadata.logoUrl.toString()}
                                  className="h-5 w-5 rounded-full"
                                  alt={buyTok.symbol}
                                />
                              )}
                              <span>{buyTok?.symbol ?? shortenAddr(order.buyTokenAddress)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-medium uppercase">
                              {order.providerId}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatFrequency(order.frequency)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-mono">
                            {sellTok
                              ? `${formatBaseAmount(order.amountSoldBase, sellTok.decimals)} ${sellTok.symbol}`
                              : formatBaseAmount(order.amountSoldBase, 18)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-mono">
                            {buyTok
                              ? `${formatBaseAmount(order.amountBoughtBase, buyTok.decimals)} ${buyTok.symbol}`
                              : formatBaseAmount(order.amountBoughtBase, 18)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(order.startDate)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn("text-[10px]", STATUS_STYLES[order.status])}
                            >
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {order.status === "ACTIVE" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={isCancelling}
                                onClick={() => handleCancel(order)}
                              >
                                {isCancelling ? (
                                  <Spinner className="h-3 w-3" />
                                ) : (
                                  <>
                                    <HugeiconsIcon
                                      icon={Cancel01Icon}
                                      strokeWidth={2}
                                      className="mr-1 h-3.5 w-3.5"
                                    />
                                    Cancel
                                  </>
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        {isExpanded && order.trades.length > 0 && (
                          <TableRow className="bg-muted/20 hover:bg-muted/20">
                            <TableCell colSpan={9} className="p-0">
                              <div className="px-10 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                  Trades ({order.trades.length})
                                </p>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b text-muted-foreground">
                                      <th className="text-left font-medium pb-1.5 pr-4">
                                        Expected Date
                                      </th>
                                      <th className="text-left font-medium pb-1.5 pr-4">Status</th>
                                      <th className="text-right font-medium pb-1.5 pr-4">Sold</th>
                                      <th className="text-right font-medium pb-1.5 pr-4">Bought</th>
                                      <th className="text-left font-medium pb-1.5">Tx</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {order.trades.map((trade: DcaTrade, i: number) => (
                                      <tr
                                        key={i}
                                        className="border-b border-border/40 last:border-0"
                                      >
                                        <td className="py-1.5 pr-4 text-muted-foreground">
                                          {formatDate(trade.expectedTradeDate)}
                                        </td>
                                        <td className="py-1.5 pr-4">
                                          <Badge
                                            variant="outline"
                                            className={cn("text-[10px]", {
                                              "bg-green-500/15 text-green-700 border-green-400/30":
                                                trade.status === "SUCCEEDED",
                                              "bg-yellow-500/15 text-yellow-700 border-yellow-400/30":
                                                trade.status === "PENDING",
                                              "bg-muted text-muted-foreground border-border":
                                                trade.status === "CANCELLED",
                                            })}
                                          >
                                            {trade.status}
                                          </Badge>
                                        </td>
                                        <td className="py-1.5 pr-4 text-right font-mono">
                                          {sellTok
                                            ? `${formatBaseAmount(trade.sellAmountBase, sellTok.decimals)} ${sellTok.symbol}`
                                            : formatBaseAmount(trade.sellAmountBase, 18)}
                                        </td>
                                        <td className="py-1.5 pr-4 text-right font-mono text-muted-foreground">
                                          {trade.buyAmountBase != null && buyTok
                                            ? `${formatBaseAmount(trade.buyAmountBase, buyTok.decimals)} ${buyTok.symbol}`
                                            : "—"}
                                        </td>
                                        <td className="py-1.5">
                                          {trade.txHash ? (
                                            <a
                                              href={`https://starkscan.co/tx/${trade.txHash}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="font-mono text-primary underline underline-offset-2 hover:opacity-80"
                                            >
                                              {trade.txHash.slice(0, 8)}…
                                            </a>
                                          ) : (
                                            <span className="text-muted-foreground">—</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Create dialog ─── */}
      <CreateDcaDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        tokens={tokensArray}
        onCreated={handleCreated}
      />
    </div>
  );
}
