---
name: zapkit-starknet
description: Starknet wallet integration patterns for AI coding assistants. Covers wallet connection, account management, transaction building, and network configuration with ZapKit.
metadata:
  author: dngbuilds
  version: "0.1.0"
---

# zapkit-starknet

This skill teaches AI assistants how to integrate Starknet wallets using ZapKit SDK (`@dngbuilds/zapkit-core` and `@dngbuilds/zapkit-react`).

## Wallet Connection

### ZapProvider Setup

Every ZapKit app must be wrapped with `ZapProvider`:

```tsx
import { ZapProvider } from "@dngbuilds/zapkit-react";

function App() {
  return (
    <ZapProvider
      config={{
        appName: "My dApp",
        chains: ["mainnet"],
        strategies: ["controller"],
      }}
    >
      {children}
    </ZapProvider>
  );
}
```

### useWallet Hook

The primary hook for wallet state:

```tsx
import { useWallet } from "@dngbuilds/zapkit-react";

const { address, status, connect, disconnect, account } = useWallet();
// status: "idle" | "connecting" | "connected" | "error"
```

### Connection Strategies

ZapKit supports multiple onboarding strategies:
- **controller** — Cartridge Controller (embedded, session keys)
- **starknet** — StarkNet native wallet (Argent, Braavos)
- **privy** — Social login via Privy

```tsx
import { useConnect } from "@dngbuilds/zapkit-react";

const { connect, connectors } = useConnect();
await connect({ strategy: "controller" });
```

## Account Management

### Address Reading

```tsx
const { address } = useWallet();
// address is the full hex address: "0x049d36570d4e46f48e99674bd3fcc84644ddddc7"
```

### StarkNet ID Resolution

```tsx
import { useStarknetId } from "@dngbuilds/zapkit-react";

const { name } = useStarknetId(address);
// name: "vitalik.stark" or null
```

### Disconnect

Always call disconnect before switching strategies:

```tsx
const { disconnect } = useWallet();
await disconnect();
```

## Transaction Building

### Single Transaction

```tsx
import { useZapKit } from "@dngbuilds/zapkit-react";

const { zapkit } = useZapKit();
const result = await zapkit.execute({
  contractAddress: TOKEN_ADDRESS,
  entrypoint: "transfer",
  calldata: [recipientAddress, amount, 0],
});
```

### Multicall (Batch Transactions)

Always batch approve + action in a single multicall:

```tsx
const result = await zapkit.execute([
  {
    contractAddress: TOKEN_ADDRESS,
    entrypoint: "approve",
    calldata: [spenderAddress, amount, 0],
  },
  {
    contractAddress: DEX_ADDRESS,
    entrypoint: "swap",
    calldata: [TOKEN_ADDRESS, amount, 0, minAmountOut, 0],
  },
]);
```

### Error Handling

Handle `UserRejectedRequestError` separately from network errors:

```tsx
try {
  await zapkit.execute(calls);
} catch (err) {
  if (err.name === "UserRejectedRequestError") {
    // User cancelled — show nothing or a mild toast
  } else {
    // Network/contract error — show error UI
    console.error("Transaction failed:", err);
  }
}
```

## Network Configuration

### Chain IDs

Use the ChainId enum, never hardcode chain IDs:

```tsx
import { ChainId } from "@dngbuilds/zapkit-core";

// ChainId.MAINNET — "SN_MAIN"
// ChainId.SEPOLIA — "SN_SEPOLIA"
// ChainId.DEVNET — "SN_DEVNET"
```

### RPC Configuration

```tsx
<ZapProvider config={{ rpcUrl: "https://starknet-mainnet.public.blastapi.io" }}>
```

## Rules

| Rule | Priority | Description |
|---|---|---|
| wallet-connect | CRITICAL | Always wrap app with ZapProvider; use hooks not direct SDK calls |
| transaction-building | HIGH | Use multicall for approve+action; always handle errors |
| error-handling | HIGH | Handle UserRejectedRequestError separately from network errors |
| network-config | MEDIUM | Use ChainId enum, never hardcode chain IDs |
| account-lifecycle | MEDIUM | Always call disconnect() before switching strategies |
