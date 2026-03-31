---
name: zapkit-wallet-ui
description: Wallet UI composition patterns using shadcn and ZapKit registry components. Covers component installation, composition, theming, and accessibility.
metadata:
  author: dngbuilds
  version: "0.1.0"
---

# zapkit-wallet-ui

This skill teaches AI assistants how to build wallet and DeFi interfaces using ZapKit registry components and shadcn composition patterns.

## Component Installation

ZapKit publishes wallet UI components via the shadcn registry. Always install via CLI — never copy code manually:

```bash
npx shadcn@latest add "https://zapkit.vercel.app/r/connect-wallet-button.json"
npx shadcn@latest add "https://zapkit.vercel.app/r/wallet-card.json"
npx shadcn@latest add "https://zapkit.vercel.app/r/address-badge.json"
npx shadcn@latest add "https://zapkit.vercel.app/r/network-badge.json"
npx shadcn@latest add "https://zapkit.vercel.app/r/token-amount.json"
npx shadcn@latest add "https://zapkit.vercel.app/r/transaction-status.json"
```

## Available Components

### ConnectWalletButton

Smart button that handles connect/disconnect states:

```tsx
import { useWallet } from "@dngbuilds/zapkit-react";
import { ConnectWalletButton } from "@/components/connect-wallet-button";

const { address, status, connect, disconnect } = useWallet();
<ConnectWalletButton
  status={status}
  address={address}
  onConnect={connect}
  onDisconnect={disconnect}
/>
```

Props: `status`, `address`, `ens`, `onConnect`, `onDisconnect`, `className`

### AddressBadge

Inline address display with tooltip and copy-on-click:

```tsx
import { AddressBadge } from "@/components/address-badge";

<AddressBadge address="0x049d...dc7" />
<AddressBadge address="0x049d...dc7" ens="vitalik.stark" />
```

Props: `address`, `ens`, `truncate`, `showCopy`, `className`

### NetworkBadge

Colored badge showing the connected network:

```tsx
import { NetworkBadge } from "@/components/network-badge";

<NetworkBadge network="mainnet" />
<NetworkBadge network="sepolia" />
```

Props: `network`, `className`

### TokenAmount

Formatted token amount with optional USD equivalent:

```tsx
import { TokenAmount } from "@/components/token-amount";

<TokenAmount amount="1.5" symbol="STRK" usdValue="0.45" />
<TokenAmount amount={BigInt("1500000000000000000")} symbol="ETH" />
```

Props: `amount`, `symbol`, `usdValue`, `decimals`, `hideSymbol`, `className`

### TransactionStatus

Inline alert showing transaction state:

```tsx
import { TransactionStatus } from "@/components/transaction-status";

<TransactionStatus status="pending" />
<TransactionStatus status="success" txHash="0x123" />
<TransactionStatus status="error" message="Insufficient balance" />
```

Props: `status`, `txHash`, `explorerUrl`, `message`, `className`

### WalletCard

Card summarising wallet: address, network, balances:

```tsx
import { WalletCard } from "@/components/wallet-card";

<WalletCard
  address={address}
  network="mainnet"
  balances={[
    { symbol: "ETH", amount: "1.234", usdValue: "3702.00" },
    { symbol: "STRK", amount: "10000" },
  ]}
  onDisconnect={disconnect}
/>
```

Props: `address`, `ens`, `network`, `balances`, `loading`, `onDisconnect`, `className`

## Composition Patterns

### Wiring Components to Hooks

Components are pure UI — wire them to ZapKit hooks:

```tsx
import { useWallet, useStaking } from "@dngbuilds/zapkit-react";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { TransactionStatus } from "@/components/transaction-status";
import { WalletCard } from "@/components/wallet-card";

function WalletPage() {
  const { address, status, connect, disconnect } = useWallet();
  const { stake, status: txStatus, txHash } = useStaking();

  if (status !== "connected") {
    return <ConnectWalletButton status={status} onConnect={connect} />;
  }

  return (
    <>
      <WalletCard address={address!} onDisconnect={disconnect} />
      {txStatus !== "idle" && (
        <TransactionStatus status={txStatus} txHash={txHash} />
      )}
    </>
  );
}
```

### Compound Components

Use compound component patterns. Don't add boolean props for every variation:

```tsx
// CORRECT: Compound components
<WalletCard address={address}>
  <WalletCard.Header />
  <WalletCard.Balances balances={balances} />
  <WalletCard.Footer onDisconnect={disconnect} />
</WalletCard>

// WRONG: Boolean prop explosion
<WalletCard showHeader showBalances showFooter showDisconnect />
```

### Loading States

Always show skeleton/spinner during async operations:

```tsx
import { WalletCard } from "@/components/wallet-card";

// loading=true shows Skeleton placeholders
<WalletCard loading={true} />
```

## Theming

- Use semantic colors: `bg-background`, `text-foreground`, `text-muted-foreground`
- Never hardcode colors like `bg-zinc-900` or `text-white`
- Dark mode works automatically via CSS variables — no `dark:` overrides needed
- Components use `cn()` for conditional Tailwind classes

## Accessibility

- ConnectWalletButton has proper `disabled` state during connecting
- AddressBadge has `aria-label` for screen readers
- TransactionStatus uses `Alert` with proper roles
- All interactive elements are keyboard accessible

## Rules

| Rule | Priority | Description |
|---|---|---|
| registry-install | CRITICAL | Always install via `npx shadcn@latest add <url>` — never copy code |
| import-paths | HIGH | Import from `@/components/<name>` — components are local after install |
| composition | HIGH | Use compound component patterns; avoid boolean prop proliferation |
| loading-states | MEDIUM | Always show skeleton/spinner during async operations |
| accessibility | MEDIUM | Keyboard-accessible buttons; proper ARIA labels on address elements |
| responsive | LOW | Wallet UI should work on mobile; use responsive card layouts |
