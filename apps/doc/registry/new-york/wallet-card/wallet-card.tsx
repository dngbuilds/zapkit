"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AddressBadge } from "@/registry/new-york/wallet-card/address-badge";
import { NetworkBadge, type NetworkName } from "@/registry/new-york/wallet-card/network-badge";
import { TokenAmount } from "@/registry/new-york/wallet-card/token-amount";
import { cn } from "@/lib/utils";

export interface WalletBalance {
  symbol: string;
  amount: string;
  usdValue?: string | null;
}

export interface WalletCardProps {
  /** Connected wallet address */
  address: string;
  /** Resolved ENS / StarkNet ID */
  ens?: string | null;
  /** Starknet network */
  network?: NetworkName;
  /** Token balances to display */
  balances?: WalletBalance[];
  /** Show skeleton loading state */
  loading?: boolean;
  /** Called when user clicks Disconnect */
  onDisconnect?: () => void;
  className?: string;
}

/**
 * A card summarising the connected wallet: address, network, balances.
 *
 * Wire up with `useWallet()` from `@dngbuilds/zapkit-react`:
 *
 * @example
 * ```tsx
 * import { useWallet } from "@dngbuilds/zapkit-react";
 * import { WalletCard } from "@/components/wallet-card";
 *
 * const { address, ens, connect, disconnect } = useWallet();
 * <WalletCard address={address!} ens={ens} onDisconnect={disconnect} />
 * ```
 */
export function WalletCard({
  address,
  ens,
  network = "mainnet",
  balances = [],
  loading = false,
  onDisconnect,
  className,
}: WalletCardProps) {
  if (loading) {
    return (
      <Card className={cn("w-72", className)}>
        <CardHeader>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-40 mt-1" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-72", className)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="text-sm">Wallet</CardTitle>
            <AddressBadge address={address} ens={ens} />
          </div>
          <NetworkBadge network={network} />
        </div>
        {ens && <CardDescription className="font-mono text-xs">{ens}</CardDescription>}
      </CardHeader>

      {balances.length > 0 && (
        <>
          <Separator />
          <CardContent className="flex flex-col gap-2 pt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Balances
            </p>
            {balances.map((b) => (
              <div key={b.symbol} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{b.symbol}</span>
                <TokenAmount
                  amount={b.amount}
                  symbol={b.symbol}
                  usdValue={b.usdValue}
                  hideSymbol
                  decimals={4}
                />
              </div>
            ))}
          </CardContent>
        </>
      )}

      {onDisconnect && (
        <CardFooter className="pt-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDisconnect}
            className="w-full text-muted-foreground hover:text-destructive"
          >
            Disconnect
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
