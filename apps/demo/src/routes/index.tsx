import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  useWallet,
  useBalance,
  useAllBridgeTokens,
  useStakingPools,
  usePresetTokens,
  fromAddress,
  type Token,
  type BridgeToken,
  type StakingPool,
  type PoolMember,
} from "@dngbuilds/zapkit-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

// Well-known Starknet token definitions (mainnet)
const ETH_TOKEN: Token = {
  name: "Ethereum",
  address: fromAddress("0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7"),
  decimals: 18,
  symbol: "ETH",
};

const STRK_TOKEN: Token = {
  name: "Starknet",
  address: fromAddress("0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"),
  decimals: 18,
  symbol: "STRK",
};

function shortenAddress(address: string) {
  return `${address.slice(0, 10)}…${address.slice(-8)}`;
}

function BalanceRow({ label, token, symbol }: { label: string; token: Token; symbol: string }) {
  const { data, isLoading, isError } = useBalance(token);

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-medium">{label}</span>
      <span className="font-mono text-sm">
        {isLoading ? (
          <Skeleton className="h-4 w-24" />
        ) : isError ? (
          <span className="text-destructive text-xs">Error</span>
        ) : (
          `${data?.toFormatted(true) ?? "0 " + symbol}`
        )}
      </span>
    </div>
  );
}

// ─── Bridge Token Balance Row ─────────────────────────────────────────────────
// Renders ONE bridge token symbol's Starknet balance.
// Only mounts for symbols that have a matching preset token.
// Only shows when balance > 0 (mounted unconditionally so hook rules are safe).
function BridgeTokenBalanceRow({
  symbol,
  token,
  chain,
}: {
  symbol: string;
  token: Token;
  chain: string;
}) {
  const { data, isLoading } = useBalance(token);
  const amount = Number(data?.toUnit?.() ?? 0);
  // Hide while loading or when balance is zero
  if (!isLoading && amount <= 0) return null;
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <div className="flex items-center gap-2">
        <span className="font-medium">{symbol}</span>
        <Badge variant="outline" className="text-[10px] px-1.5">
          {chain}
        </Badge>
      </div>
      <span className="font-mono text-xs">
        {isLoading ? <Skeleton className="h-3 w-16 inline-block" /> : data?.toFormatted(true)}
      </span>
    </div>
  );
}

// Deduplicate bridge tokens by symbol, match to Starknet presets, show balances.
function BridgeTokenList({
  tokens,
  presets,
}: {
  tokens: BridgeToken[];
  presets: Record<string, Token>;
}) {
  // Build unique (symbol → chain) pairs from bridge tokens, matched to presets
  const rows = useMemo(() => {
    const seen = new Set<string>();
    const out: { symbol: string; token: Token; chain: string }[] = [];
    for (const bt of tokens) {
      const sym = String(bt.symbol ?? "").toUpperCase();
      if (!sym || seen.has(sym)) continue;
      const preset = presets[sym];
      if (!preset) continue; // no Starknet token for this symbol
      seen.add(sym);
      out.push({ symbol: sym, token: preset, chain: String(bt.chain ?? "ethereum") });
    }
    return out;
  }, [tokens, presets]);

  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">No bridgeable tokens found.</p>;

  return (
    <div className="space-y-0.5">
      {rows.map((r) => (
        <BridgeTokenBalanceRow key={r.symbol} symbol={r.symbol} token={r.token} chain={r.chain} />
      ))}
    </div>
  );
}

// ─── Staking Position Item ───────────────────────────────────────────────────
// Per-pool component: fetches the user's position and only renders if staked > 0.
function StakingPositionItem({
  sp,
  wallet,
  isConnected,
}: {
  sp: StakingPool;
  wallet: ReturnType<typeof useWallet>["wallet"];
  isConnected: boolean;
}) {
  const [member, setMember] = useState<PoolMember | null | undefined>(undefined); // undefined = loading

  const castedMember = !isConnected || !wallet || !sp.pool.poolContract ? null : member;

  useEffect(() => {
    if (!wallet) {
      return;
    }
    let cancelled = false;
    wallet
      .getPoolPosition(fromAddress(String(sp.pool.poolContract)))
      .then((m: PoolMember | null) => {
        if (!cancelled) setMember(m);
      })
      .catch(() => {
        if (!cancelled) setMember(null);
      });
    return () => {
      cancelled = true;
    };
  }, [wallet, isConnected, sp.pool.poolContract]);

  const stakedRaw = castedMember?.staked ? Number(castedMember.staked.toUnit()) : 0;
  const unpoolingRaw = castedMember?.unpooling ? Number(castedMember.unpooling.toUnit()) : 0;
  const rewardsRaw = castedMember?.rewards ? Number(castedMember.rewards.toUnit()) : 0;

  // Show skeleton while loading; hide entirely when no stake or exiting amount
  if (!isConnected) return null;
  if (castedMember === undefined) return <Skeleton className="h-16 w-full rounded-lg" />;
  if (stakedRaw <= 0 && unpoolingRaw <= 0) return null;

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center gap-2">
        {sp.validator.logoUrl ? (
          <img
            src={sp.validator.logoUrl.toString()}
            alt={sp.validator.name}
            className="h-5 w-5 rounded-full"
          />
        ) : (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[9px] font-bold">
            {sp.validator.name.charAt(0)}
          </div>
        )}
        <span className="text-sm font-medium">{sp.validator.name}</span>
        <Badge variant="secondary" className="text-xs">
          {sp.pool.token!.symbol}
        </Badge>
        {unpoolingRaw > 0 && (
          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
            Exiting
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 text-xs">
        {stakedRaw > 0 && (
          <>
            <span className="text-muted-foreground">Your Stake</span>
            <span className="font-mono text-right">{castedMember?.staked?.toFormatted(true)}</span>
          </>
        )}
        {unpoolingRaw > 0 && (
          <>
            <span className="text-muted-foreground">Exiting</span>
            <span className="font-mono text-right text-amber-600">
              {castedMember?.unpooling?.toFormatted(true)}
            </span>
          </>
        )}
        {rewardsRaw > 0 && (
          <>
            <span className="text-muted-foreground">Rewards</span>
            <span className="font-mono text-right text-green-600">
              {castedMember?.rewards?.toFormatted(true)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function DashboardPage() {
  const { wallet, status } = useWallet();
  const address = wallet?.address ? String(wallet.address) : null;
  const isConnected = status === "connected";
  const bridgeTokens = useAllBridgeTokens();
  const presetTokens = usePresetTokens();
  const { pools, isLoading: stakingLoading, isError: stakingError } = useStakingPools();

  // Only use pools that have a well-defined token symbol
  const stakingPoolsWithToken = useMemo(
    () => pools.filter((sp) => !!sp.pool?.token?.symbol),
    [pools],
  );

  return (
    <div className="space-y-6">
      {/* Wallet Info */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Wallet</CardTitle>
            <CardDescription>Your connected Starknet account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isConnected ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Address</span>
                  <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono">
                    {address ? shortenAddress(address) : "—"}
                  </code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant="default">connected</Badge>
                </div>
                {address && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Full Address</span>
                    <button
                      className="rounded bg-muted px-2 py-0.5 text-xs font-mono hover:bg-muted/80 transition-colors cursor-pointer"
                      onClick={() => void navigator.clipboard.writeText(address)}
                      title="Click to copy"
                    >
                      {address}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-3/4" />
              </div>
            )}
          </CardContent>
        </Card>
        {/* Token Balances */}
        <Card>
          <CardHeader>
            <CardTitle>Token Balances</CardTitle>
            <CardDescription>
              Live balances via <code className="text-xs">useBalance()</code> hook — auto-refreshes
              every 30s
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isConnected ? (
              <>
                <BalanceRow label="Ethereum" token={ETH_TOKEN} symbol="ETH" />
                <Separator />
                <BalanceRow label="Starknet" token={STRK_TOKEN} symbol="STRK" />
              </>
            ) : (
              <div className="space-y-3">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bridge Tokens</CardTitle>
            <CardDescription>Tokens with Starknet balance available to bridge</CardDescription>
          </CardHeader>
          <CardContent>
            {bridgeTokens.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <BridgeTokenList tokens={bridgeTokens.data ?? []} presets={presetTokens} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Staking Positions</CardTitle>
            <CardDescription>Your active staking positions</CardDescription>
          </CardHeader>
          <CardContent>
            {!isConnected ? (
              <p className="text-sm text-muted-foreground">
                Connect your wallet to see your staking positions.
              </p>
            ) : stakingLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            ) : stakingError ? (
              <p className="text-sm text-destructive">Failed to load staking data</p>
            ) : (
              <div className="space-y-3">
                {stakingPoolsWithToken.map((sp, i) => (
                  <StakingPositionItem
                    key={String(sp.pool.poolContract ?? i)}
                    sp={sp}
                    wallet={wallet}
                    isConnected={isConnected}
                  />
                ))}
                <p className="text-xs text-muted-foreground pt-1">
                  Visit the Staking page to manage positions and earn rewards.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: DashboardPage,
});
