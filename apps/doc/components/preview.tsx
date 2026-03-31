"use client";

import type { ReactNode } from "react";
import { ConnectWalletButton } from "@/registry/new-york/connect-wallet-button/connect-wallet-button";
import { AddressBadge } from "@/registry/new-york/address-badge/address-badge";
import { NetworkBadge } from "@/registry/new-york/network-badge/network-badge";
import { TokenAmount } from "@/registry/new-york/token-amount/token-amount";
import { TransactionStatus } from "@/registry/new-york/transaction-status/transaction-status";
import { WalletCard } from "@/registry/new-york/wallet-card/wallet-card";

/* ─── Theme-aware preview wrapper ────────────────────────────────── */

export function ComponentPreview({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose flex flex-col items-center gap-4 rounded-xl border border-border bg-background p-8 mb-6">
      {children}
    </div>
  );
}

/* ─── ConnectWalletButton ──────────────────────────────────────── */

export function ConnectWalletButtonPreview() {
  return (
    <ComponentPreview>
      <div className="flex flex-wrap items-center gap-3">
        <ConnectWalletButton status="idle" />
        <ConnectWalletButton
          status="connected"
          address="0x049d36570d4e46f48e99674bd3fcc84644ddddc7"
        />
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Disconnected and connected states
      </p>
    </ComponentPreview>
  );
}

/* ─── AddressBadge ──────────────────────────────────────────────── */

export function AddressBadgePreview() {
  return (
    <ComponentPreview>
      <div className="flex flex-wrap items-center gap-3">
        <AddressBadge
          address="0x049d36570d4e46f48e99674bd3fcc84644ddddc7"
          showCopy={false}
        />
        <AddressBadge
          address="0x049d36570d4e46f48e99674bd3fcc84644ddddc7"
          ens="vitalik.stark"
          showCopy={false}
        />
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Address and StarkNet ID variants
      </p>
    </ComponentPreview>
  );
}

/* ─── NetworkBadge ──────────────────────────────────────────────── */

export function NetworkBadgePreview() {
  return (
    <ComponentPreview>
      <div className="flex flex-wrap items-center gap-3">
        <NetworkBadge network="mainnet" />
        <NetworkBadge network="sepolia" />
        <NetworkBadge network="devnet" />
      </div>
    </ComponentPreview>
  );
}

/* ─── TokenAmount ──────────────────────────────────────────────── */

export function TokenAmountPreview() {
  return (
    <ComponentPreview>
      <div className="flex flex-col items-start gap-2">
        <TokenAmount amount="1234.5678" symbol="ETH" usdValue="3703915.20" />
        <TokenAmount amount="10000" symbol="STRK" />
        <TokenAmount amount="0.000001" symbol="ETH" />
      </div>
    </ComponentPreview>
  );
}

/* ─── TransactionStatus ─────────────────────────────────────────── */

export function TransactionStatusPreview() {
  return (
    <ComponentPreview>
      <div className="flex w-full max-w-sm flex-col gap-2.5">
        <TransactionStatus status="pending" />
        <TransactionStatus
          status="success"
          txHash="0x123abc"
          explorerUrl="https://starkscan.co/tx/"
        />
        <TransactionStatus status="error" message="Insufficient balance" />
      </div>
    </ComponentPreview>
  );
}

/* ─── WalletCard ────────────────────────────────────────────────── */

export function WalletCardPreview() {
  return (
    <ComponentPreview>
      <WalletCard
        address="0x049d36570d4e46f48e99674bd3fcc84644ddddc7"
        network="mainnet"
        balances={[
          { symbol: "ETH", amount: "1.234", usdValue: "3702.00" },
          { symbol: "STRK", amount: "10000" },
        ]}
      />
    </ComponentPreview>
  );
}
