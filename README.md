<div align="center">

# ⚡ ZapKit

**The Starknet wallet SDK — connect, transact, and build DeFi in minutes.**

[![npm core](https://img.shields.io/npm/v/@dngbuilds/zapkit-core?label=%40dngbuilds%2Fzapkit-core&color=0a0a0a)](https://www.npmjs.com/package/@dngbuilds/zapkit-core)
[![npm react](https://img.shields.io/npm/v/@dngbuilds/zapkit-react?label=%40dngbuilds%2Fzapkit-react&color=0a0a0a)](https://www.npmjs.com/package/@dngbuilds/zapkit-react)
[![Docs](https://img.shields.io/badge/docs-zapkit.vercel.app-blue)](https://zapkit.vercel.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

[Documentation](https://zapkit.vercel.app) · [Getting Started](https://zapkit.vercel.app/docs/getting-started) · [Components](https://zapkit.vercel.app/docs/components) · [Agent Skills](https://zapkit.vercel.app/docs/skills)

</div>

---

## What is ZapKit?

ZapKit is a full-stack Starknet developer toolkit that provides:

- **SDK packages** — Wallet connection, transaction building, and DeFi operations
- **UI components** — Drop-in shadcn registry components for wallet UIs
- **Agent skills** — AI coding skills that teach Copilot/Cursor how to build on Starknet

## Packages

| Package                                     | Description                                                        | Version                                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| [`@dngbuilds/zapkit-core`](packages/core)   | Starknet wallet SDK — Cartridge Controller, transactions, bridging | [![npm](https://img.shields.io/npm/v/@dngbuilds/zapkit-core?color=0a0a0a)](https://www.npmjs.com/package/@dngbuilds/zapkit-core)   |
| [`@dngbuilds/zapkit-react`](packages/react) | React hooks & provider — `ZapProvider`, `useWallet`, `useStaking`  | [![npm](https://img.shields.io/npm/v/@dngbuilds/zapkit-react?color=0a0a0a)](https://www.npmjs.com/package/@dngbuilds/zapkit-react) |

## UI Components (shadcn Registry)

Copy-paste wallet and DeFi UI components via the shadcn CLI:

```bash
npx shadcn@latest add "https://zapkit.vercel.app/r/connect-wallet-button.json"
npx shadcn@latest add "https://zapkit.vercel.app/r/wallet-card.json"
```

Available components: `connect-wallet-button` · `address-badge` · `network-badge` · `token-amount` · `transaction-status` · `wallet-card`

[Browse all components →](https://zapkit.vercel.app/docs/components)

## Agent Skills

AI coding skills for Starknet development, powered by the [skills.sh](https://skills.sh/) ecosystem. Install into your project so Copilot, Cursor, Claude Code, Windsurf, and 40+ agents know how to use ZapKit:

```bash
# Install all ZapKit skills
npx skills add dngbuilds/zapkit

# Or install specific skills
npx skills add dngbuilds/zapkit --skill zapkit-starknet
npx skills add dngbuilds/zapkit --skill zapkit-defi
npx skills add dngbuilds/zapkit --skill zapkit-wallet-ui
```

[Learn about skills →](https://zapkit.vercel.app/docs/skills)

## Quick Start

```bash
npm install @dngbuilds/zapkit-core @dngbuilds/zapkit-react
```

```tsx
import { ZapProvider, useWallet } from "@dngbuilds/zapkit-react";

function App() {
  return (
    <ZapProvider>
      <Wallet />
    </ZapProvider>
  );
}

function Wallet() {
  const { address, status, connect, disconnect } = useWallet();

  if (status === "connected") {
    return <button onClick={disconnect}>{address}</button>;
  }
  return <button onClick={connect}>Connect Wallet</button>;
}
```

## Monorepo Structure

```
zapkit/
├── packages/
│   ├── core/          # @dngbuilds/zapkit-core — Starknet SDK
│   └── react/         # @dngbuilds/zapkit-react — React hooks & provider
├── apps/
│   ├── doc/           # Documentation site (zapkit.vercel.app)
│   ├── demo/          # Interactive demo app
```

## Development

This monorepo uses [Vite+](https://github.com/nicepkg/vite-plus) (`vp`) with pnpm workspaces.

```bash
# Install dependencies
pnpm install

# Run the doc site
pnpm docs

# Run the demo app
pnpm demo

# Lint, format, test & build everything
pnpm ready
```

## Contributing

Contributions are welcome! Please open an issue or PR on [GitHub](https://github.com/dngbuilds/zapkit).

## License

[MIT](LICENSE) © [DngBuilds](https://github.com/dngbuilds)
