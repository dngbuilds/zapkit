<div align="center">
  <h1>⚡ @dngbuilds/zapkit-react</h1>
  <p><strong>React hooks and provider for Starknet — wallet connection in minutes, not hours.</strong></p>

  <p>
    <a href="https://www.npmjs.com/package/@dngbuilds/zapkit-react"><img src="https://img.shields.io/npm/v/@dngbuilds/zapkit-react?color=blue&label=npm" alt="npm version" /></a>
    <a href="https://www.npmjs.com/package/@dngbuilds/zapkit-react"><img src="https://img.shields.io/npm/dm/@dngbuilds/zapkit-react?color=green" alt="npm downloads" /></a>
    <a href="https://github.com/DngBuilds/zapkit/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="license" /></a>
  </p>
</div>

---

## Overview

`@dngbuilds/zapkit-react` provides a `<ZapProvider>` context and a set of React hooks for connecting wallets, fetching balances, staking, swapping, and bridging on Starknet. It builds on top of [`@dngbuilds/zapkit-core`](https://www.npmjs.com/package/@dngbuilds/zapkit-core) and uses [TanStack Query](https://tanstack.com/query) for data fetching.

## Installation

```bash
npm install @dngbuilds/zapkit-react
```

> `@dngbuilds/zapkit-core` is included as a dependency — you don't need to install it separately.

## Quick Start

### 1. Wrap your app with `<ZapProvider>`

```tsx
import { ZapProvider } from "@dngbuilds/zapkit-react";

function App() {
  return (
    <ZapProvider config={{ network: "mainnet" }}>
      <YourApp />
    </ZapProvider>
  );
}
```

### 2. Connect a wallet

```tsx
import { useWallet, OnboardStrategy } from "@dngbuilds/zapkit-react";

function ConnectButton() {
  const { address, status, connect, disconnect } = useWallet();

  if (status === "connected") {
    return (
      <div>
        <p>{address}</p>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    );
  }

  return (
    <button
      disabled={status === "connecting"}
      onClick={() => connect({ strategy: OnboardStrategy.Cartridge })}
    >
      {status === "connecting" ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}
```

### 3. Fetch balances

```tsx
import { useBalance } from "@dngbuilds/zapkit-react";

function Balance() {
  const { data, isLoading } = useBalance({
    token: { symbol: "ETH", address: "0x049d…" },
  });

  if (isLoading) return <p>Loading…</p>;
  return <p>ETH: {data?.toString()}</p>;
}
```

## Provider

### `<ZapProvider>`

Wraps your application and initializes ZapKit + TanStack Query.

```tsx
<ZapProvider
  config={{ network: "mainnet" }}
  queryClient={customQueryClient} // optional — bring your own
  showDevPanel={false} // optional — error overlay for dev
>
  <App />
</ZapProvider>
```

| Prop           | Type           | Default | Description                   |
| -------------- | -------------- | ------- | ----------------------------- |
| `config`       | `ZapKitConfig` | —       | Network and SDK configuration |
| `queryClient`  | `QueryClient`  | auto    | Custom TanStack Query client  |
| `showDevPanel` | `boolean`      | `false` | Show developer error panel    |

## Hooks

### `useWallet()`

Returns wallet connection state and actions.

```ts
const {
  address, // string | null — connected wallet address
  ens, // string | null — resolved StarkNet ID
  status, // "idle" | "connecting" | "connected" | "error"
  balances, // Record<string, string>
  loading, // boolean
  error, // Error | null
  connect, // (options: OnboardOptions) => Promise<void>
  disconnect, // () => void
  ensureReady, // () => Promise<void>
} = useWallet();
```

### `useZapKit()`

Returns the raw `ZapKit` instance for advanced use cases.

```ts
const zapkit = useZapKit();
await zapkit?.stake({ poolAddress: "0x…", amount });
```

### Query Hooks (TanStack Query)

| Hook                  | Description                    |
| --------------------- | ------------------------------ |
| `useBalance()`        | Fetch token balance            |
| `useStakingPools()`   | List available staking pools   |
| `useBridgingTokens()` | List available bridging tokens |

### Mutation Hooks (TanStack Query)

| Hook           | Description                     |
| -------------- | ------------------------------- |
| `useSwap()`    | Execute a token swap            |
| `useStaking()` | Stake / unstake / claim rewards |
| `useLending()` | Lending protocol interactions   |

## Pre-built UI Components

ZapKit also provides a set of ready-to-use shadcn components you can install directly into your project:

```bash
npx shadcn@latest add "https://zapkit.vercel.app/r/connect-wallet-button.json"
npx shadcn@latest add "https://zapkit.vercel.app/r/wallet-card.json"
```

Available components: `connect-wallet-button`, `address-badge`, `network-badge`, `wallet-card`, `token-amount`, `transaction-status`.

Browse the full registry at [zapkit.vercel.app](https://zapkit.vercel.app).

## Re-exported from Core

For convenience, the following are re-exported from `@dngbuilds/zapkit-core`:

```ts
// Values
export { OnboardStrategy, Amount, fromAddress, StarkSigner };
export { Tx, TxBuilder, ChainId, ExternalChain, BridgeToken };
export { getPresets, accountPresets };

// Types
export type { OnboardOptions, OnboardResult, Token, Pool, Address, Wallet };
export type { CartridgeWalletInterface, ConnectCartridgeOptions };
export type { EnsureReadyOptions, ExecuteOptions, RpcProvider, Call };
```

## Wallet Strategies

| Strategy  | Import                      | Description                   |
| --------- | --------------------------- | ----------------------------- |
| Cartridge | `OnboardStrategy.Cartridge` | Social login & passkeys       |
| Signer    | `OnboardStrategy.Signer`    | Direct private-key signing    |
| Privy     | `OnboardStrategy.Privy`     | Email & social auth via Privy |

## Vite Configuration

Add the ZapKit Vite plugin to resolve optional peer dependencies:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { zapkitPlugin } from "@dngbuilds/zapkit-core/vite";

export default defineConfig({
  plugins: [react(), zapkitPlugin()],
});
```

## License

[MIT](https://github.com/DngBuilds/zapkit/blob/master/LICENSE)
