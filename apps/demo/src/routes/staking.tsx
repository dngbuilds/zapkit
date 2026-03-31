import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  useStaking,
  useStakingPools,
  useWallet,
  useBalance,
  Amount,
  fromAddress,
  type PoolMember,
  type StakingPool,
} from "@dngbuilds/zapkit-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";

import { DataTable } from "@/components/data-table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";

// ─── Helpers ───────────────────────────────────────────────────────

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── Row type for table ────────────────────────────────────────────

interface StakingRow {
  validatorName: string;
  validatorLogo: string | null;
  tokenSymbol: string;
  tokenName: string;
  tokenAddress: string;
  tokenLogoUrl?: string;
  poolContract: string;
  poolAmount: string;
  staked: string | null;
  stakedRaw: number;
  rewards: string | null;
  rewardsRaw: number;
  commissionPercent: number | null;
  totalValue: string | null;
  unpooling: string | null;
  unpoolingRaw: number;
  unpoolTime: Date | null;
  positionLoading: boolean;
  pool: StakingPool["pool"];
  validator: StakingPool["validator"];
}

// ─── Column builder ────────────────────────────────────────────────

function buildColumns(
  isConnected: boolean,
  onStake: (row: StakingRow) => void,
  onClaim: (row: StakingRow) => void,
  onRedeem: (row: StakingRow) => void,
): ColumnDef<StakingRow>[] {
  return [
    {
      id: "validator",
      header: "Validator",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.validatorLogo ? (
            <img
              src={row.original.validatorLogo}
              alt={row.original.validatorName}
              className="h-6 w-6 rounded-full"
            />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
              {row.original.validatorName.charAt(0)}
            </div>
          )}
          <span className="text-sm font-medium">{row.original.validatorName}</span>
        </div>
      ),
    },
    {
      id: "token",
      header: "Token",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.tokenLogoUrl ? (
            <img
              src={row.original.tokenLogoUrl}
              alt={row.original.tokenSymbol}
              className="h-5 w-5 rounded-full"
            />
          ) : null}
          <Badge variant="secondary">{row.original.tokenSymbol}</Badge>
        </div>
      ),
    },
    {
      id: "duration",
      header: "Duration",
      cell: ({ row }) => {
        const hasStake = row.original.stakedRaw > 0;
        const isExiting = row.original.unpoolingRaw > 0;
        if (isExiting && hasStake) {
          // Both staked and exiting — show combined status
          return (
            <div className="flex flex-col gap-0.5">
              <Badge variant="outline" className="text-xs w-fit">
                Staked
              </Badge>
              <div className="flex items-center gap-1">
                <Badge variant="destructive" className="text-xs w-fit">
                  Exiting
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {row.original.unpoolTime
                    ? row.original.unpoolTime > new Date()
                      ? row.original.unpoolTime.toLocaleDateString()
                      : "Ready!"
                    : "…"}
                </span>
              </div>
            </div>
          );
        }
        if (isExiting) {
          return (
            <div className="flex flex-col">
              <Badge variant="destructive" className="text-xs w-fit">
                Exiting
              </Badge>
              <span className="text-[10px] text-muted-foreground mt-0.5">
                {row.original.unpoolTime
                  ? row.original.unpoolTime > new Date()
                    ? `Ready ${row.original.unpoolTime.toLocaleDateString()}`
                    : "Ready to withdraw"
                  : "Pending…"}
              </span>
            </div>
          );
        }
        return (
          <Badge variant="outline" className="text-xs">
            Flexible
          </Badge>
        );
      },
    },
    {
      id: "estDailyRewards",
      header: "Est. Daily Rewards",
      cell: ({ row }) =>
        row.original.positionLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : row.original.stakedRaw > 0 && row.original.commissionPercent != null ? (
          <span className="font-mono text-xs text-green-600 dark:text-green-400">
            {estimateDailyReward(row.original.stakedRaw, row.original.commissionPercent).toFixed(6)}{" "}
            {row.original.tokenSymbol}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "staked",
      header: "Your Position",
      cell: ({ row }) => {
        if (row.original.positionLoading) return <Skeleton className="h-4 w-20" />;
        const hasStake = row.original.stakedRaw > 0;
        const isExiting = row.original.unpoolingRaw > 0;
        if (!hasStake && !isExiting)
          return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <div className="flex flex-col gap-0.5">
            {hasStake && <span className="font-mono text-sm">{row.original.staked}</span>}
            {isExiting && (
              <span className="font-mono text-xs text-amber-600 dark:text-amber-400">
                {row.original.unpooling} exiting
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "commissionPercent",
      header: "Commission",
      cell: ({ row }) =>
        row.original.positionLoading ? (
          <Skeleton className="h-4 w-12" />
        ) : row.original.commissionPercent != null ? (
          <Badge variant="outline">{row.original.commissionPercent}%</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "rewards",
      header: "Rewards",
      cell: ({ row }) =>
        row.original.positionLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : row.original.rewards ? (
          <span className="font-mono text-sm text-green-600 dark:text-green-400">
            {row.original.rewards}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const hasStake = row.original.stakedRaw > 0;
        const isExiting = row.original.unpoolingRaw > 0;
        const hasRewards = row.original.rewardsRaw > 0;
        return (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => onStake(row.original)}>
              Stake
            </Button>
            {hasRewards && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onClaim(row.original)}
                disabled={!isConnected}
              >
                Claim
              </Button>
            )}
            {isExiting ? (
              <Button
                size="sm"
                variant={
                  row.original.unpoolTime && row.original.unpoolTime <= new Date()
                    ? "default"
                    : "outline"
                }
                onClick={() => onRedeem(row.original)}
                disabled={!isConnected}
              >
                {row.original.unpoolTime && row.original.unpoolTime <= new Date()
                  ? "Withdraw"
                  : "Withdraw ⏳"}
              </Button>
            ) : hasStake ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onRedeem(row.original)}
                disabled={!isConnected}
              >
                Redeem
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];
}

/** Approximate STRK staking base APR (~3.8%). Real value varies with protocol. */
const BASE_STAKING_APR = 0.038;

/** Estimate daily reward = staked * baseAPR * (1 - commission/100) / 365 */
function estimateDailyReward(staked: number, commissionPercent: number): number {
  return (staked * BASE_STAKING_APR * (1 - commissionPercent / 100)) / 365;
}

// ─── Stake Sheet ──────────────────────────────────────────────────

interface StakeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pool: StakingRow;
  isPending: boolean;
  stake: (params: {
    poolAddress: ReturnType<typeof fromAddress>;
    amount: Amount;
  }) => Promise<unknown>;
  onSuccess: () => Promise<void>;
}

function StakeSheet({ open, onOpenChange, pool, isPending, stake, onSuccess }: StakeSheetProps) {
  const [amount, setAmount] = useState("");
  // pool is always defined when this sheet is open — no type cast needed
  const balanceQuery = useBalance(pool.pool.token);
  const balance = balanceQuery.data;
  const balanceUnit = balance?.toUnit() ?? null;
  const balanceFormatted = balance?.toFormatted(true) ?? null;

  const parsed = Number(amount);
  const isValid = amount !== "" && !Number.isNaN(parsed) && parsed > 0;
  const exceeds = isValid && balanceUnit != null && parsed > Number(balanceUnit);
  const canStake = isValid && !exceeds && !!pool.poolContract;

  async function handleStake() {
    if (!pool.poolContract || !amount) return;
    try {
      const parsedAmount = Amount.parse(amount, pool.pool.token.decimals, pool.tokenSymbol);
      await stake({ poolAddress: fromAddress(pool.poolContract), amount: parsedAmount });
      setAmount("");
      onOpenChange(false);
      await onSuccess();
      toast.success("Staked successfully", {
        description: `${amount} ${pool.tokenSymbol} staked with ${pool.validatorName}`,
      });
    } catch (err) {
      toast.error("Stake failed", {
        description: (err as Error)?.message ?? "Transaction was rejected or failed",
      });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Stake with {pool.validatorName}</SheetTitle>
          <SheetDescription>Stake {pool.tokenSymbol} into this validator's pool</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            {pool.validatorLogo ? (
              <img
                src={pool.validatorLogo}
                alt={pool.validatorName}
                className="h-10 w-10 rounded-full"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-bold">
                {pool.validatorName.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-medium">{pool.validatorName}</p>
              <Badge variant="secondary" className="text-xs">
                {pool.tokenSymbol}
              </Badge>
            </div>
          </div>

          <div className="rounded-lg border p-3 flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pool Contract</span>
              <code className="text-xs font-mono">
                {pool.poolContract ? shortenAddress(pool.poolContract) : "—"}
              </code>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Commission</span>
              <span className="font-medium">
                {pool.commissionPercent != null ? `${pool.commissionPercent}%` : "—"}
              </span>
            </div>
            {pool.staked && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Stake</span>
                <span className="font-mono">{pool.staked}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="stake-amount">Amount ({pool.tokenSymbol})</Label>
              {balanceFormatted != null && (
                <span className="text-xs text-muted-foreground">
                  Balance: <span className="font-mono">{balanceFormatted}</span>
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                id="stake-amount"
                type="text"
                inputMode="decimal"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={exceeds ? "border-destructive pr-16" : "pr-16"}
              />
              {balanceUnit != null && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-xs"
                  onClick={() => setAmount(balanceUnit)}
                >
                  MAX
                </Button>
              )}
            </div>
            {exceeds && (
              <p className="text-xs text-destructive">
                Insufficient balance. You have {balanceFormatted}.
              </p>
            )}
            {amount !== "" && !isValid && (
              <p className="text-xs text-destructive">Enter a valid amount greater than 0.</p>
            )}
          </div>

          {isValid && pool.commissionPercent != null && (
            <>
              <Separator />
              <div className="rounded-lg border p-3 flex flex-col gap-2">
                <p className="text-sm font-medium">Summary</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Duration</span>
                  <Badge variant="outline" className="text-xs">
                    Flexible
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Est. Daily Rewards</span>
                  <span className="font-mono text-green-600 dark:text-green-400">
                    {estimateDailyReward(parsed, pool.commissionPercent).toFixed(6)}{" "}
                    {pool.tokenSymbol}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  * Based on ~{(BASE_STAKING_APR * 100).toFixed(1)}% protocol APR. Actual returns
                  may vary.
                </p>
              </div>
            </>
          )}
        </div>

        <SheetFooter>
          <Button onClick={handleStake} disabled={isPending || !canStake} className="w-full">
            {isPending ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Staking…
              </>
            ) : (
              "Stake"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Claim Sheet ──────────────────────────────────────────────────

interface ClaimSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pool: StakingRow;
  isPending: boolean;
  claimReward: (poolAddress: ReturnType<typeof fromAddress>) => Promise<unknown>;
  onSuccess: () => Promise<void>;
}

function ClaimSheet({
  open,
  onOpenChange,
  pool,
  isPending,
  claimReward,
  onSuccess,
}: ClaimSheetProps) {
  async function handleClaim() {
    if (!pool.poolContract) return;
    try {
      await claimReward(fromAddress(pool.poolContract));
      onOpenChange(false);
      await onSuccess();
      toast.success("Rewards claimed!", {
        description: `Rewards from ${pool.validatorName} claimed to your wallet`,
      });
    } catch (err) {
      toast.error("Claim failed", {
        description: (err as Error)?.message ?? "Transaction was rejected or failed",
      });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Claim Rewards — {pool.validatorName}</SheetTitle>
          <SheetDescription>
            Review your position and claim unclaimed rewards from {pool.validatorName}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          <div className="flex items-center gap-3">
            {pool.validatorLogo ? (
              <img
                src={pool.validatorLogo}
                alt={pool.validatorName}
                className="h-10 w-10 rounded-full"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-bold">
                {pool.validatorName.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-medium">{pool.validatorName}</p>
              <p className="text-xs text-muted-foreground">{pool.tokenSymbol}</p>
            </div>
          </div>

          <div className="rounded-lg border p-4 flex flex-col gap-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Pool</span>
              <code className="text-xs font-mono">
                {pool.poolContract ? shortenAddress(pool.poolContract) : "—"}
              </code>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Your Stake</span>
              <span className="font-mono text-sm">{pool.staked ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Commission</span>
              <span className="text-sm">
                {pool.commissionPercent != null ? `${pool.commissionPercent}%` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Value</span>
              <span className="font-mono text-sm">{pool.totalValue ?? "—"}</span>
            </div>
            <div className="flex justify-between border-t pt-3">
              <span className="text-sm font-medium">Unclaimed Rewards</span>
              <span className="font-mono text-sm font-semibold text-green-600 dark:text-green-400">
                {pool.rewards ?? "0"}
              </span>
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button
            onClick={handleClaim}
            disabled={isPending || !pool.poolContract}
            className="w-full"
          >
            {isPending ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Claiming…
              </>
            ) : (
              "Claim Rewards"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Redeem Sheet ─────────────────────────────────────────────────

interface RedeemSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pool: StakingRow;
  isPending: boolean;
  claimReward: (poolAddress: ReturnType<typeof fromAddress>) => Promise<unknown>;
  exitIntent: (params: {
    poolAddress: ReturnType<typeof fromAddress>;
    amount: Amount;
  }) => Promise<unknown>;
  exitPool: (poolAddress: ReturnType<typeof fromAddress>) => Promise<unknown>;
  onSuccess: () => Promise<void>;
  onClose: () => void;
}

function RedeemSheet({
  open,
  onOpenChange,
  pool,
  isPending,
  claimReward,
  exitIntent,
  exitPool,
  onSuccess,
  onClose,
}: RedeemSheetProps) {
  const [amount, setAmount] = useState("");

  const hasActiveExit = pool.unpoolingRaw > 0;
  const parsedRedeem = Number(amount);
  const isValidRedeem = amount !== "" && !Number.isNaN(parsedRedeem) && parsedRedeem > 0;
  const exceedsStake = isValidRedeem && pool.stakedRaw > 0 && parsedRedeem > pool.stakedRaw + 1e-12;
  const canRedeem = isValidRedeem && !exceedsStake && !hasActiveExit && !!pool.poolContract;

  async function handleWithdraw() {
    if (!pool.poolContract) return;
    const poolAddress = fromAddress(pool.poolContract);
    try {
      if (pool.rewardsRaw > 0) {
        try {
          await claimReward(poolAddress);
        } catch {
          /* continue */
        }
      }
      await exitPool(poolAddress);
      onOpenChange(false);
      onClose();
      await onSuccess();
      toast.success("Withdrawal complete!", {
        description: `Tokens withdrawn from ${pool.validatorName} to your wallet`,
      });
    } catch (err) {
      toast.error("Withdrawal failed", {
        description: (err as Error)?.message ?? "Transaction was rejected or failed",
      });
    }
  }

  async function handleRedeem() {
    if (!pool.poolContract || !amount || hasActiveExit) return;
    const poolAddress = fromAddress(pool.poolContract);
    try {
      if (pool.rewardsRaw > 0) {
        try {
          await claimReward(poolAddress);
        } catch {
          /* continue */
        }
      }
      const parsedAmount = Amount.parse(amount, pool.pool.token.decimals, pool.tokenSymbol);
      await exitIntent({ poolAddress, amount: parsedAmount });
      setAmount("");
      onOpenChange(false);
      await onSuccess();
      toast.success("Exit intent submitted", {
        description: `Rewards claimed and ${amount} ${pool.tokenSymbol} unstake requested from ${pool.validatorName}. Once the cooldown passes, come back to withdraw.`,
      });
    } catch (err) {
      toast.error("Redeem failed", {
        description: (err as Error)?.message ?? "Transaction was rejected or failed",
      });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>
            {hasActiveExit ? "Withdraw" : "Redeem"} — {pool.validatorName}
          </SheetTitle>
          <SheetDescription>
            {hasActiveExit
              ? `Complete your pending withdrawal from ${pool.validatorName}.`
              : `Unstake your tokens from ${pool.validatorName}. Rewards are claimed automatically.`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            {pool.validatorLogo ? (
              <img
                src={pool.validatorLogo}
                alt={pool.validatorName}
                className="h-10 w-10 rounded-full"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-bold">
                {pool.validatorName.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-medium">{pool.validatorName}</p>
              <Badge variant="secondary" className="text-xs">
                {pool.tokenSymbol}
              </Badge>
            </div>
          </div>

          <div className="rounded-lg border p-3 flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Your Stake</span>
              <span className="font-mono">{pool.staked ?? "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Unclaimed Rewards</span>
              <span className="font-mono text-green-600 dark:text-green-400">
                {pool.rewards ?? "0"}
              </span>
            </div>
            {pool.unpoolingRaw > 0 && (
              <>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Currently Exiting</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400">
                    {pool.unpooling}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Withdraw Available</span>
                  <span className="text-xs">
                    {pool.unpoolTime
                      ? pool.unpoolTime > new Date()
                        ? pool.unpoolTime.toLocaleString()
                        : "Now — ready to withdraw!"
                      : "Pending…"}
                  </span>
                </div>
              </>
            )}
          </div>

          {hasActiveExit ? (
            <div className="flex flex-col gap-3">
              {pool.unpoolTime && pool.unpoolTime <= new Date() ? (
                <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 p-3">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Your exit cooldown has passed. Click <strong>Withdraw Tokens</strong> below to
                    transfer {pool.unpooling} to your wallet.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 p-3">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {pool.unpooling} is exiting and will be available for withdrawal on{" "}
                    <strong>{pool.unpoolTime?.toLocaleString() ?? "—"}</strong>.
                    {pool.stakedRaw > 0
                      ? " You cannot submit a new redeem until this withdrawal is complete."
                      : " Come back after the cooldown to withdraw."}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="redeem-amount">Amount to redeem ({pool.tokenSymbol})</Label>
                  {pool.staked && (
                    <span className="text-xs text-muted-foreground">
                      Staked: <span className="font-mono">{pool.staked}</span>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="redeem-amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={exceedsStake ? "border-destructive pr-16" : "pr-16"}
                  />
                  {pool.stakedRaw > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-xs"
                      onClick={() => setAmount(String(pool.stakedRaw))}
                    >
                      MAX
                    </Button>
                  )}
                </div>
                {exceedsStake && (
                  <p className="text-xs text-destructive">
                    Exceeds your staked amount of {pool.staked}.
                  </p>
                )}
                {amount !== "" && !isValidRedeem && (
                  <p className="text-xs text-destructive">Enter a valid amount greater than 0.</p>
                )}
              </div>

              {isValidRedeem && (
                <div className="rounded-lg border p-3 flex flex-col gap-2">
                  <p className="text-sm font-medium">This will:</p>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                    <li>Claim any outstanding rewards</li>
                    <li>
                      Submit exit intent for {amount} {pool.tokenSymbol}
                    </li>
                    {pool.stakedRaw > 0 && parsedRedeem >= pool.stakedRaw - 1e-12 && (
                      <li className="text-amber-600 dark:text-amber-400 font-medium">
                        Full unstake — after cooldown passes, click "Withdraw" to collect your
                        tokens
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <SheetFooter>
          {hasActiveExit ? (
            <Button
              onClick={handleWithdraw}
              disabled={isPending || !pool.unpoolTime || pool.unpoolTime > new Date()}
              className="w-full"
            >
              {isPending ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Withdrawing…
                </>
              ) : (
                "Withdraw Tokens"
              )}
            </Button>
          ) : (
            <Button
              onClick={handleRedeem}
              disabled={isPending || !canRedeem}
              variant="destructive"
              className="w-full"
            >
              {isPending ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Redeeming…
                </>
              ) : (
                "Redeem"
              )}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Page component ────────────────────────────────────────────────

function StakingPage() {
  "use no memo"; // TanStack Table returns unstable references incompatible with React Compiler
  const { status } = useWallet();
  const isConnected = status === "connected";
  // Pool data — standalone hook so the table re-renders independently of mutations
  const { pools, isLoading, isError } = useStakingPools();
  // Mutations + wallet helpers
  const staking = useStaking();
  const { getPosition, getCommission } = staking;

  // ─── Per-pool position + commission state ────────────────────
  const [positionMap, setPositionMap] = useState<Record<string, PoolMember | null>>({});
  const [commissionMap, setCommissionMap] = useState<Record<string, number | null>>({});
  const [positionsLoading, setPositionsLoading] = useState(false);

  // Fetch positions sequentially to avoid rate limits
  const fetchPositions = async () => {
    if (!isConnected || pools.length === 0) return;
    setPositionsLoading(true);
    const newPositions: Record<string, PoolMember | null> = {};
    const newCommissions: Record<string, number | null> = {};
    await Promise.all(
      pools.map(async (sp) => {
        const poolAddr = String(sp.pool?.poolContract);
        if (!poolAddr) return;
        try {
          const [pos, comm] = await Promise.all([
            getPosition(fromAddress(poolAddr)),
            getCommission(fromAddress(poolAddr)),
          ]);
          newPositions[poolAddr] = pos;
          newCommissions[poolAddr] = comm;
        } catch {
          newPositions[poolAddr] = null;
          newCommissions[poolAddr] = null;
        }
      }),
    );
    setPositionMap(newPositions);
    setCommissionMap(newCommissions);
    setPositionsLoading(false);
  };

  // Fetch positions when connected and pools are available
  useEffect(() => {
    if (isConnected && pools.length > 0) {
      void fetchPositions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, pools.length]);

  // Sheet state
  const [stakeOpen, setStakeOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [activePool, setActivePool] = useState<StakingRow | null>(null);

  // ─── Build rows from hook data (sorted by commission %) ─────
  const rows: StakingRow[] = pools
    .map((sp) => {
      const pool = sp.pool;
      const poolAddr = pool?.poolContract;
      const pos = positionMap[poolAddr];
      const token = pool?.token;
      const commPercent = commissionMap[poolAddr] ?? null;

      return {
        validatorName: sp.validator.name,
        validatorLogo: sp.validator.logoUrl?.toString() ?? null,
        tokenSymbol: token?.symbol ?? "STRK",
        tokenName: token?.name ?? "Starknet Token",
        tokenAddress: String(token?.address ?? ""),
        tokenLogoUrl: token?.metadata?.logoUrl?.toString(),
        poolContract: poolAddr,
        poolAmount: pool?.amount?.toFormatted?.(true) ?? "—",
        staked: pos?.staked?.toFormatted?.(true) ?? null,
        stakedRaw: Number(pos?.staked?.toUnit?.() ?? 0),
        rewards: pos?.rewards?.toFormatted?.(true) ?? null,
        rewardsRaw: Number(pos?.rewards?.toUnit?.() ?? 0),
        commissionPercent: commPercent,
        totalValue: pos?.total?.toFormatted?.(true) ?? null,
        unpooling: pos?.unpooling?.isZero() ? null : (pos?.unpooling?.toFormatted?.(true) ?? null),
        unpoolingRaw: Number(pos?.unpooling?.toUnit?.() ?? 0),
        unpoolTime: pos?.unpoolTime ?? null,
        positionLoading: positionsLoading,
        pool,
        validator: sp.validator,
      };
    })
    .sort((a, b) => (a.commissionPercent ?? Infinity) - (b.commissionPercent ?? Infinity));

  // ─── Column defs ─────────────────────────────────────────────
  const columns = buildColumns(
    isConnected,
    (row) => {
      setActivePool(row);
      setStakeOpen(true);
    },
    (row) => {
      setActivePool(row);
      setClaimOpen(true);
    },
    (row) => {
      setActivePool(row);
      setRedeemOpen(true);
    },
  );

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Unified Staking Table ─── */}
      <Card>
        <CardHeader>
          <CardTitle>Staking Pools</CardTitle>
          <CardDescription>
            {isConnected
              ? `All available staking pools across ${rows.length} validator${rows.length !== 1 ? "s" : ""}`
              : "Connect your wallet to stake tokens and earn rewards"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isConnected ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : isError ? (
            <p className="text-sm text-muted-foreground">
              Failed to load staking pools. Please try again.
            </p>
          ) : (
            <DataTable columns={columns} data={rows} emptyMessage="No staking pools found" />
          )}
        </CardContent>
      </Card>

      {activePool && (
        <>
          <StakeSheet
            open={stakeOpen}
            onOpenChange={setStakeOpen}
            pool={activePool}
            isPending={staking.isPending}
            stake={staking.stake}
            onSuccess={fetchPositions}
          />
          <ClaimSheet
            open={claimOpen}
            onOpenChange={setClaimOpen}
            pool={activePool}
            isPending={staking.isPending}
            claimReward={staking.claimReward}
            onSuccess={fetchPositions}
          />
          <RedeemSheet
            open={redeemOpen}
            onOpenChange={setRedeemOpen}
            pool={activePool}
            isPending={staking.isPending}
            claimReward={staking.claimReward}
            exitIntent={staking.exitIntent}
            exitPool={staking.exitPool}
            onSuccess={fetchPositions}
            onClose={() => setActivePool(null)}
          />
        </>
      )}
    </div>
  );
}

export const Route = createFileRoute("/staking")({
  component: StakingPage,
});
