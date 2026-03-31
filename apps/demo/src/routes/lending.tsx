import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  useLendingMarketsQuery,
  useLendingUserPositionsQuery,
  useLendingHealthQuery,
  useLendingDepositMutation,
  useLendingWithdrawMaxMutation,
  useBorrowMutation,
  useRepayMutation,
  usePresetTokens,
  useBalance,
  useWallet,
  useNetwork,
  Amount,
  fromAddress,
} from "@dngbuilds/zapkit-react";
import type { LendingMarket, LendingUserPosition, LendingHealth } from "@dngbuilds/zapkit-react";
import type { Token } from "@dngbuilds/zapkit-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Vesu's Sepolia integration-test pool ("WBTC Prime Sepolia" on-chain)
// No marketsApiUrl is configured for Sepolia, so getMarkets() returns []
// on any non-mainnet chain. We build mock markets from preset tokens for UI preview.
const VESU_SEPOLIA_POOL = fromAddress(
  "0x06227c13372b8c7b7f38ad1cfe05b5cf515b4e5c596dd05fe8437ab9747b2093",
);

/** Unique key for a market — poolAddress + asset address avoids collisions when
 *  one pool hosts multiple assets (which is the normal Vesu layout on mainnet). */
function mkey(m: LendingMarket): string {
  return `${m.poolAddress}::${m.asset.address ?? m.asset.symbol}`;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/lending")({
  component: LendingPage,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a bigint (1e18-scaled USD value) to a display string like "$1,234.56" */
function fmtUsd(v: bigint | undefined): string {
  if (v === undefined) return "—";
  return `$${(Number(v) / 1e18).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Format a token base-unit bigint to a human-readable string. */
function fmtToken(amount: bigint | undefined, token: Token | undefined): string {
  if (amount === undefined || !token) return "—";
  const decimals = token.decimals ?? 18;
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const frac = (amount % divisor).toString().padStart(decimals, "0").slice(0, 4).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

/** Convert a token base-unit bigint to a string fit for Amount.parse() */
function bigintToStr(amount: bigint, token: Token): string {
  const decimals = token.decimals ?? 18;
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const frac = (amount % divisor).toString().padStart(decimals, "0");
  return `${whole}.${frac}`;
}

/** Format an Amount (APY / APR) as a percentage string. */
function fmtApy(apy: Amount | undefined): string {
  if (!apy) return "—";
  try {
    const val = Number(apy.toUnit());
    // starkzap returns APY as a decimal fraction (0.055 = 5.5%) or as a percent
    // If value > 1 it's already a percentage, otherwise multiply by 100
    const pct = val > 1 ? val : val * 100;
    return `${pct.toFixed(2)}%`;
  } catch {
    return "—";
  }
}

/** Compute a simple health factor from collateral and debt USD values (both 1e18 scale). */
function computeHealthFactor(health: LendingHealth | undefined): number | null {
  if (!health) return null;
  if (health.debtValue === 0n) return null; // no debt → infinite
  return Number((health.collateralValue * 10000n) / health.debtValue) / 10000;
}

/** Same but from a raw position (collateral.usdValue / debt.usdValue). */
function positionHealthFactor(pos: LendingUserPosition): number | null {
  const col = pos.collateral.usdValue ?? 0n;
  const debt = pos.debt?.usdValue ?? 0n;
  if (debt === 0n) return null;
  return Number((col * 10000n) / debt) / 10000;
}

// ─── HealthBadge ──────────────────────────────────────────────────────────────

function HealthBadge({ factor }: { factor: number | null }) {
  if (factor === null)
    return (
      <Badge variant="outline" className="text-xs">
        No Debt
      </Badge>
    );
  if (factor > 1.5)
    return (
      <Badge className="bg-green-100 text-green-800 text-xs border-green-200">
        Safe — {factor.toFixed(2)}
      </Badge>
    );
  if (factor > 1.2)
    return (
      <Badge className="bg-amber-100 text-amber-800 text-xs border-amber-200">
        Warning — {factor.toFixed(2)}
      </Badge>
    );
  return (
    <Badge className="bg-red-100 text-red-800 text-xs border-red-200">
      At Risk — {factor.toFixed(2)}
    </Badge>
  );
}

// ─── HealthBar ────────────────────────────────────────────────────────────────

function HealthBar({ factor }: { factor: number | null }) {
  if (factor === null) return null;
  const pct = Math.min((factor / 2.5) * 100, 100); // cap at 2.5x for display
  const color = factor > 1.5 ? "bg-green-500" : factor > 1.2 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── MarketSelect ─────────────────────────────────────────────────────────────

function MarketSelect({
  markets,
  value,
  onChange,
  placeholder = "Select token",
}: {
  markets: LendingMarket[];
  value: string;
  onChange: (key: string) => void;
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {markets.map((m) => (
          <SelectItem key={mkey(m)} value={mkey(m)}>
            <div className="flex items-center gap-2">
              {m.asset.metadata?.logoUrl ? (
                <img
                  src={m?.asset?.metadata?.logoUrl.toString()}
                  alt={m.asset.symbol}
                  className="h-4 w-4 rounded-full"
                />
              ) : (
                <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold">
                  {m.asset.symbol?.charAt(0)}
                </div>
              )}
              <span className="font-medium">{m.asset.symbol}</span>
              {m.stats?.supplyApy && (
                <span className="text-xs text-muted-foreground ml-1">
                  {fmtApy(m.stats.supplyApy)} APY
                </span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── BalanceSummary ───────────────────────────────────────────────────────────

function BalanceSummary({ isConnected }: { isConnected: boolean }) {
  const { data: positions, isLoading } = useLendingUserPositionsQuery();

  const { totalDeposited, totalBorrowed } = useMemo(() => {
    if (!positions) return { totalDeposited: 0n, totalBorrowed: 0n };
    let dep = 0n;
    let brw = 0n;
    for (const p of positions) {
      if (p.type === "earn") dep += p.collateral.usdValue ?? 0n;
      else brw += p.debt?.usdValue ?? 0n;
    }
    return { totalDeposited: dep, totalBorrowed: brw };
  }, [positions]);

  const netBalance = totalDeposited - totalBorrowed;

  if (!isConnected) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Connect your wallet to view your lending balance.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Overview</CardTitle>
        <CardDescription>Your current lending & borrowing summary</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Net Balance</p>
              <p
                className={cn(
                  "text-xl font-semibold tabular-nums",
                  netBalance < 0n && "text-red-600",
                )}
              >
                {fmtUsd(netBalance < 0n ? 0n : netBalance)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Deposited</p>
              <p className="text-xl font-semibold tabular-nums text-green-700">
                {fmtUsd(totalDeposited)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Borrowed</p>
              <p className="text-xl font-semibold tabular-nums text-amber-700">
                {fmtUsd(totalBorrowed)}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── DepositCard ──────────────────────────────────────────────────────────────

function DepositCard({
  markets,
  isConnected,
  isMainnet,
}: {
  markets: LendingMarket[];
  isConnected: boolean;
  isMainnet: boolean;
}) {
  const [selectedKey, setSelectedKey] = useState<string>(() =>
    markets[0] ? mkey(markets[0]) : "",
  );
  const [amountStr, setAmountStr] = useState("");

  const { deposit, isDepositing, depositError, reset } = useLendingDepositMutation();

  const selectedMarket = useMemo(
    () => markets.find((m) => mkey(m) === selectedKey) ?? markets[0],
    [markets, selectedKey],
  );

  // useBalance requires a Token — selectedMarket is always defined when DepositCard renders
  const { data: balance, isLoading: balanceLoading } = useBalance(selectedMarket!.asset);
  const balanceStr = balanceLoading
    ? "…"
    : balance
      ? Number(balance.toUnit()).toLocaleString(undefined, { maximumFractionDigits: 6 })
      : "0";

  const canDeposit =
    isConnected && !!selectedMarket && amountStr.length > 0 && Number(amountStr) > 0;

  async function handleDeposit() {
    if (!selectedMarket || !canDeposit) return;
    try {
      const amount = Amount.parse(amountStr, selectedMarket.asset);
      await deposit({
        request: { token: selectedMarket.asset, amount, poolAddress: selectedMarket.poolAddress },
      });
      toast.success(`Deposited ${amountStr} ${selectedMarket.asset.symbol}`);
      setAmountStr("");
      reset();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Deposit failed";
      toast.error(msg);
      reset();
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Deposit</CardTitle>
          {selectedMarket?.stats?.supplyApy && (
            <Badge variant="secondary" className="text-xs">
              {fmtApy(selectedMarket.stats.supplyApy)} APY
            </Badge>
          )}
        </div>
        <CardDescription>Supply assets to earn interest</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Token select */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Token</Label>
          <MarketSelect
            markets={markets}
            value={selectedKey}
            onChange={(v) => {
              setSelectedKey(v);
              setAmountStr("");
            }}
            placeholder="Select token to deposit"
          />
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Amount</Label>
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => {
                if (balance)
                  setAmountStr(
                    Number(balance.toUnit())
                      .toFixed(6)
                      .replace(/\.?0+$/, ""),
                  );
              }}
            >
              Balance: {balanceStr} {selectedMarket?.asset.symbol}
            </button>
          </div>
          <Input
            placeholder="0.00"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            inputMode="decimal"
            className="text-lg font-semibold"
          />
        </div>

        {/* Stats row */}
        {selectedMarket?.stats && (
          <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground flex gap-4">
            {selectedMarket.stats.supplyApy && (
              <span>
                Supply APY:{" "}
                <strong className="text-foreground">
                  {fmtApy(selectedMarket.stats.supplyApy)}
                </strong>
              </span>
            )}
            {selectedMarket.stats.totalSupplied && (
              <span>
                Protocol TVL:{" "}
                <strong className="text-foreground">
                  {fmtApy(selectedMarket.stats.totalSupplied)}
                </strong>
              </span>
            )}
          </div>
        )}

        {depositError && (
          <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{depositError.message}</p>
        )}

        <Button
          className="w-full"
          disabled={!canDeposit || isDepositing || !isMainnet}
          onClick={handleDeposit}
        >
          {isDepositing ? (
            <span className="flex items-center gap-2">
              <Spinner /> Depositing…
            </span>
          ) : !isMainnet ? (
            "Mainnet only"
          ) : (
            `Deposit ${selectedMarket?.asset.symbol ?? ""}`
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── BorrowCard ───────────────────────────────────────────────────────────────

function BorrowCard({
  markets,
  isConnected,
  isMainnet,
}: {
  markets: LendingMarket[];
  isConnected: boolean;
  isMainnet: boolean;
}) {
  const borrowableMarkets = useMemo(
    () => markets.filter((m) => m.canBeBorrowed !== false),
    [markets],
  );

  // Default collateral = ETH, debt = USDC
  const defaultCollKey = useMemo(() => {
    const m = markets.find((m) => m.asset.symbol?.toUpperCase() === "ETH") ?? markets[0];
    return m ? mkey(m) : "";
  }, [markets]);
  const defaultDebtKey = useMemo(() => {
    const m =
      borrowableMarkets.find((m) => m.asset.symbol?.toUpperCase() === "USDC") ??
      borrowableMarkets[0];
    return m ? mkey(m) : "";
  }, [borrowableMarkets]);

  const [collKey, setCollKey] = useState(defaultCollKey);
  const [debtKey, setDebtKey] = useState(defaultDebtKey);
  const [amountStr, setAmountStr] = useState("");

  const collMarket = markets.find((m) => mkey(m) === collKey) ?? markets[0];
  const debtMarket = borrowableMarkets.find((m) => mkey(m) === debtKey) ?? borrowableMarkets[0];

  const { borrow, isBorrowing, borrowError, reset } = useBorrowMutation();

  // Health query for the collateral/debt pair
  const healthReq =
    collMarket && debtMarket && isConnected
      ? { collateralToken: collMarket.asset, debtToken: debtMarket.asset }
      : null;
  const { data: health, isLoading: healthLoading } = useLendingHealthQuery(healthReq);
  const healthFactor = computeHealthFactor(health);

  const canBorrow =
    isConnected && !!collMarket && !!debtMarket && amountStr.length > 0 && Number(amountStr) > 0;

  async function handleBorrow() {
    if (!collMarket || !debtMarket || !canBorrow) return;
    try {
      const amount = Amount.parse(amountStr, debtMarket.asset);
      await borrow({
        request: {
          collateralToken: collMarket.asset,
          debtToken: debtMarket.asset,
          amount,
        },
      });
      toast.success(`Borrowed ${amountStr} ${debtMarket.asset.symbol}`);
      setAmountStr("");
      reset();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Borrow failed";
      toast.error(msg);
      reset();
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Borrow</CardTitle>
        <CardDescription>Borrow against your deposited collateral</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Collateral token */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Collateral</Label>
          <MarketSelect
            markets={markets}
            value={collKey}
            onChange={setCollKey}
            placeholder="Select collateral token"
          />
        </div>

        {/* Debt token */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Borrow</Label>
          <MarketSelect
            markets={borrowableMarkets}
            value={debtKey}
            onChange={setDebtKey}
            placeholder="Select token to borrow"
          />
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Amount</Label>
          <Input
            placeholder="0.00"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            inputMode="decimal"
            className="text-lg font-semibold"
          />
        </div>

        {/* Borrow APR */}
        {debtMarket?.stats?.borrowApr && (
          <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Borrow APR:{" "}
            <strong className="text-foreground">{fmtApy(debtMarket.stats.borrowApr)}</strong>
          </div>
        )}

        {/* Health section */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Current Health</span>
            {healthLoading ? (
              <Skeleton className="h-4 w-16" />
            ) : (
              <HealthBadge factor={healthFactor} />
            )}
          </div>
          <HealthBar factor={healthFactor} />
          {health && (
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>
                Collateral:{" "}
                <strong className="text-foreground">{fmtUsd(health.collateralValue)}</strong>
              </span>
              <span>
                Borrowed: <strong className="text-foreground">{fmtUsd(health.debtValue)}</strong>
              </span>
            </div>
          )}
        </div>

        {borrowError && (
          <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{borrowError.message}</p>
        )}

        <Button
          className="w-full"
          disabled={!canBorrow || isBorrowing || !isMainnet}
          onClick={handleBorrow}
          variant={healthFactor !== null && healthFactor <= 1.2 ? "destructive" : "default"}
        >
          {isBorrowing ? (
            <span className="flex items-center gap-2">
              <Spinner /> Borrowing…
            </span>
          ) : !isMainnet ? (
            "Mainnet only"
          ) : (
            `Borrow ${debtMarket?.asset.symbol ?? ""}`
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── PositionRow ──────────────────────────────────────────────────────────────

function PositionRow({ position }: { position: LendingUserPosition }) {
  const { withdrawMax, isWithdrawingMax } = useLendingWithdrawMaxMutation();
  const { repay, isRepaying } = useRepayMutation();
  const [busy, setBusy] = useState(false);

  const hf = positionHealthFactor(position);
  const isEarn = position.type === "earn";

  async function handleWithdrawMax() {
    if (busy) return;
    setBusy(true);
    try {
      await withdrawMax({ request: { token: position.collateral.token } });
      toast.success(`Withdrawn ${position.collateral.token.symbol}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Withdraw failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRepayAll() {
    if (busy || !position.debt) return;
    setBusy(true);
    try {
      const debtAmount = position.debt.amount;
      const debtToken = position.debt.token;
      const amount = Amount.parse(bigintToStr(debtAmount, debtToken), debtToken);
      await repay({
        request: {
          collateralToken: position.collateral.token,
          debtToken,
          amount,
          withdrawCollateral: false,
        },
      });
      toast.success(`Repaid ${debtToken.symbol}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Repay failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={isEarn ? "secondary" : "outline"} className="text-xs">
            {isEarn ? "Earn" : "Borrow"}
          </Badge>
          <span className="text-sm font-medium text-muted-foreground">
            {position.pool.name ?? position.pool.id.slice(0, 10) + "…"}
          </span>
        </div>
        {!isEarn && <HealthBadge factor={hf} />}
      </div>

      {/* Amounts */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Deposited</p>
          <p className="font-semibold tabular-nums">
            {fmtToken(position.collateral.amount, position.collateral.token)}{" "}
            <span className="text-muted-foreground font-normal">
              {position.collateral.token.symbol}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">{fmtUsd(position.collateral.usdValue)}</p>
        </div>
        {position.debt && (
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Borrowed</p>
            <p className="font-semibold tabular-nums">
              {fmtToken(position.debt.amount, position.debt.token)}{" "}
              <span className="text-muted-foreground font-normal">
                {position.debt.token.symbol}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">{fmtUsd(position.debt.usdValue)}</p>
          </div>
        )}
      </div>

      {/* Health bar for borrow positions */}
      {!isEarn && hf !== null && <HealthBar factor={hf} />}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {isEarn ? (
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={isWithdrawingMax || busy}
            onClick={handleWithdrawMax}
          >
            {isWithdrawingMax || busy ? (
              <span className="flex items-center gap-1.5">
                <Spinner /> Withdrawing…
              </span>
            ) : (
              "Withdraw All"
            )}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={isRepaying || busy}
            onClick={handleRepayAll}
          >
            {isRepaying || busy ? (
              <span className="flex items-center gap-1.5">
                <Spinner /> Repaying…
              </span>
            ) : (
              "Repay All"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── PositionCard ─────────────────────────────────────────────────────────────

function PositionCard({ isConnected }: { isConnected: boolean }) {
  const { data: positions, isLoading } = useLendingUserPositionsQuery();

  if (!isConnected) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Your Positions</CardTitle>
        <CardDescription>Manage your active lending and borrowing positions</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : !positions || positions.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <p>No active positions.</p>
            <p className="text-xs mt-1">Deposit assets above to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {positions.map((pos, i) => (
              <PositionRow key={`${pos.pool.id}-${pos.type}-${i}`} position={pos} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── LendingPage ──────────────────────────────────────────────────────────────

function LendingPage() {
  const { status } = useWallet();
  const isConnected = status === "connected";
  const network = useNetwork();
  const isMainnet = network === "mainnet";
  const presetTokens = usePresetTokens();

  const { data: markets, isLoading: marketsLoading } = useLendingMarketsQuery();

  // Vesu's SN_SEPOLIA preset has no marketsApiUrl → getMarkets() always returns []
  // on non-mainnet. Build demo markets from preset tokens so the UI is still previewable.
  const mockMarkets = useMemo<LendingMarket[]>(() => {
    if (isMainnet) return [];
    const BORROWABLE = ["USDC", "STRK"];
    return Object.values(presetTokens)
      .filter((t) => ["ETH", "USDC", "STRK"].includes(t.symbol?.toUpperCase() ?? ""))
      .map((asset) => ({
        protocol: "vesu",
        poolAddress: VESU_SEPOLIA_POOL,
        poolName: "Vesu Sepolia (demo)",
        asset,
        vTokenAddress: VESU_SEPOLIA_POOL,
        canBeBorrowed: BORROWABLE.includes(asset.symbol?.toUpperCase() ?? ""),
      }));
  }, [isMainnet, presetTokens]);

  const liveMarkets = markets ?? [];
  // Use real markets when available, fall back to mock for UI preview on Sepolia
  const supplyMarkets = liveMarkets.length > 0 ? liveMarkets : mockMarkets;

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Lending</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Deposit assets to earn yield. Borrow against your collateral.
        </p>
      </div>

      {/* Mainnet-only banner */}
      {!isMainnet && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
          <span className="mt-0.5">⚠️</span>
          <div>
            <strong>Mainnet only</strong> — Vesu lending markets are only available on Starknet
            Mainnet. The UI is showing <strong>mock market data</strong> for preview. Deposit and
            Borrow buttons are disabled.
          </div>
        </div>
      )}

      {/* Balance Summary */}
      <BalanceSummary isConnected={isConnected} />

      {/* Deposit + Borrow side by side */}
      {marketsLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : supplyMarkets.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No lending markets available on this network.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <DepositCard markets={supplyMarkets} isConnected={isConnected} isMainnet={isMainnet} />
          <BorrowCard markets={supplyMarkets} isConnected={isConnected} isMainnet={isMainnet} />
        </div>
      )}

      {/* Positions */}
      <PositionCard isConnected={isConnected} />
    </div>
  );
}
