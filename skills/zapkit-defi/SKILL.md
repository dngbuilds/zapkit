---
name: zapkit-defi
description: DeFi building blocks and patterns for Starknet applications. Covers token operations, swaps, staking, lending, and bridge patterns with ZapKit.
metadata:
  author: dngbuilds
  version: "0.1.0"
---

# zapkit-defi

This skill teaches AI assistants DeFi-specific patterns for Starknet using ZapKit.

## Token Operations

### ERC-20 Approve + Transfer

Always check allowance before spending. Batch approve + action in multicall:

```tsx
import { useZapKit } from "@dngbuilds/zapkit-react";

const { zapkit } = useZapKit();

// Always multicall: approve + swap in one transaction
await zapkit.execute([
  {
    contractAddress: TOKEN_ADDRESS,
    entrypoint: "approve",
    calldata: [spenderAddress, amountLow, amountHigh],
  },
  {
    contractAddress: DEX_ADDRESS,
    entrypoint: "swap",
    calldata: [tokenIn, tokenOut, amountIn, 0, minAmountOut, 0],
  },
]);
```

### Amount Handling

Use `BigInt` for all token amounts. Format only at the display layer:

```tsx
// CORRECT: Use BigInt internally
const amount = BigInt("1500000000000000000"); // 1.5 ETH in wei

// CORRECT: Format for display only
const display = (Number(amount) / 1e18).toLocaleString();

// WRONG: Don't use floating point for arithmetic
const bad = 1.5 * 1e18; // floating point precision issues
```

### Balance Reading

```tsx
import { useBalance } from "@dngbuilds/zapkit-react";

const { balance, isLoading, refetch } = useBalance({
  address,
  token: ETH_ADDRESS,
});
// balance: bigint
```

## Swap Integration

### AMM Patterns

Supported DEXs on Starknet: Ekubo, JediSwap, 10KSwap, Avnu

```tsx
import { useSwap } from "@dngbuilds/zapkit-react";

const { quote, execute, status } = useSwap({
  tokenIn: ETH_ADDRESS,
  tokenOut: STRK_ADDRESS,
  amount: parseUnits("1.0", 18),
  slippage: 0.5, // 0.5%
});
```

### Slippage Protection

Never submit swaps without slippage bounds:

```tsx
// CORRECT: Always set slippage
const minAmountOut = (quoteAmount * BigInt(995)) / BigInt(1000); // 0.5% slippage

// WRONG: No slippage protection
await swap({ amount, minAmountOut: 0n }); // vulnerable to MEV
```

### Quote Freshness

Re-fetch quotes immediately before submission:

```tsx
const submitSwap = async () => {
  const freshQuote = await refetchQuote();
  if (freshQuote.priceImpact > 5) {
    showWarning("High price impact!");
    return;
  }
  await execute(freshQuote);
};
```

## Staking

### Liquid Staking (stSTRK)

```tsx
import { useStaking } from "@dngbuilds/zapkit-react";

const { stake, unstake, apy, status, txHash } = useStaking();

// Stake STRK → receive stSTRK
await stake({ amount: parseUnits("100", 18) });

// Unstake stSTRK → receive STRK (subject to unbonding period)
await unstake({ amount: parseUnits("50", 18) });
```

### APY Calculation

Fetch APY from the protocol, don't hardcode:

```tsx
const { apy } = useStaking();
// apy: number (e.g., 5.2 = 5.2%)
```

## Lending & Borrowing

### zkLend / Nostra Patterns

```tsx
import { useLending } from "@dngbuilds/zapkit-react";

const { supply, borrow, repay, healthFactor } = useLending({
  protocol: "zklend",
});

// Always check health factor before borrowing
if (healthFactor > 1.5) {
  await borrow({ token: ETH_ADDRESS, amount });
}
```

## Bridge

### StarkGate / LayerSwap

```tsx
import { useBridge } from "@dngbuilds/zapkit-react";

const { deposit, withdraw, status } = useBridge();

// L1 → L2 deposit
await deposit({ token: ETH_ADDRESS, amount, l1Address });

// Track status
// status: "pending" | "accepted_on_l2" | "confirmed"
```

## Rules

| Rule | Priority | Description |
|---|---|---|
| token-approvals | CRITICAL | Always check allowance before swap; batch approve + action in multicall |
| slippage-protection | CRITICAL | Never submit swaps without slippage bounds |
| amount-handling | HIGH | Use BigInt for all token amounts; format only at display layer |
| quote-freshness | HIGH | Re-fetch quotes before submission; show staleness warnings |
| error-recovery | MEDIUM | Handle reverted transactions gracefully with user-friendly messages |
| balance-caching | MEDIUM | Cache balances with SWR pattern; invalidate after transactions |
