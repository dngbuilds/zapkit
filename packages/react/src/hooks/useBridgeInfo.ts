import { useQuery } from "@tanstack/react-query";
import { useZapContext } from "../context";
import {
  type BridgeToken,
  type ConnectedExternalWallet,
  type BridgeDepositOptions,
  type BridgeDepositFeeEstimation,
  type Amount,
  type ExternalAddress,
  ConnectedEthereumWallet,
  ConnectedSolanaWallet,
  ExternalChain,
  type ConnectEthereumWalletOptions,
  type ConnectSolanaWalletOptions,
} from "starkzap";

// ─── EVM network compatibility ──────────────────────────────────────

// Maps Starknet chainId → expected EVM hex chain IDs
const STARKNET_TO_EVM: Record<string, { chainId: string; name: string; starknetName: string }> = {
  SN_MAIN: {
    chainId: "0x1",
    name: "Ethereum Mainnet",
    starknetName: "Starknet Mainnet",
  },
  SN_SEPOLIA: {
    chainId: "0xaa36a7",
    name: "Ethereum Sepolia",
    starknetName: "Starknet Sepolia",
  },
};

const KNOWN_EVM_NAMES: Record<string, string> = {
  "0x1": "Ethereum Mainnet",
  "0x5": "Ethereum Goerli",
  "0xaa36a7": "Ethereum Sepolia",
};

function getEvmNetworkName(hexChainId: string): string {
  return KNOWN_EVM_NAMES[hexChainId.toLowerCase()] ?? `chain ${hexChainId}`;
}

// ─── Detect browser providers ──────────────────────────────────────

function getEvmProvider(): ConnectEthereumWalletOptions["provider"] | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.ethereum as ConnectEthereumWalletOptions["provider"]) ?? null;
}

function getSolanaProvider(): ConnectSolanaWalletOptions["provider"] | null {
  const w = window as unknown as Record<string, unknown>;
  // Phantom / Backpack / Solflare all expose `window.solana`
  const sol = (w.solana ?? (w.phantom as Record<string, unknown>)?.solana) as
    | ConnectSolanaWalletOptions["provider"]
    | undefined;
  return sol ?? null;
}

// ─── Types ─────────────────────────────────────────────────────────

export interface BridgeInfo {
  externalWallet: ConnectedExternalWallet;
  available: Amount;
  allowance: Amount | null;
  fees: BridgeDepositFeeEstimation;
}

export interface UseBridgeInfoReturn {
  /** Resolved bridge info (wallet + balance + allowance + fees) */
  data: BridgeInfo | undefined;
  /** True whenever a fetch is in-flight (first load AND retries after error) */
  isFetching: boolean;
  /** Error during connect or fetch */
  error: Error | null;
  /** Re-trigger the query (e.g. after a deposit to refresh balance) */
  refetch: () => void;
  /** Clear cached result and re-run from scratch (e.g. switch wallet account) */
  reset: () => void;
}

// ─── Hook ──────────────────────────────────────────────────────────

/**
 * Auto-connects the correct external wallet for a bridge token and
 * fetches deposit balance, ERC-20 allowance, and fee estimate in one shot.
 *
 * The user does NOT need to manually connect — the hook prompts the
 * browser wallet (MetaMask / Phantom) automatically when enabled.
 *
 * @param token  The `BridgeToken` to inspect (from `useBridge().allTokens`)
 * @param opts   Optional `{ fastTransfer }` passed to fee estimation
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useBridgeInfo(token);
 * if (data) {
 *   console.log(data.available.toFormatted(true)); // "1.23 ETH"
 *   console.log(data.fees);
 *   await bridge.deposit({ ... externalWallet: data.externalWallet });
 * }
 * ```
 */
export function useBridgeInfo(
  token: BridgeToken<ExternalAddress> | null,
  opts?: Partial<BridgeDepositOptions>,
): UseBridgeInfoReturn {
  const { wallet } = useZapContext();

  const queryKey = [
    "bridge",
    "info",
    token ? String(token.chain) : null,
    token ? String(token.address) : null,
  ];

  const query = useQuery<BridgeInfo>({
    queryKey,
    enabled: !!wallet && !!token,
    staleTime: 30_000,
    retry: false, // wallet prompts shouldn't retry automatically
    queryFn: async (): Promise<BridgeInfo> => {
      if (!wallet) throw new Error("Starknet wallet not connected");
      if (!token) throw new Error("No bridge token provided");

      const chainId = wallet.getChainId();

      // ── Connect the right external wallet ──────────────────────
      let extWallet: ConnectedExternalWallet;

      if (token.chain === ExternalChain.ETHEREUM) {
        const provider = getEvmProvider();
        if (!provider) {
          throw new Error(
            "No Ethereum wallet detected. Install MetaMask or another EIP-1193 wallet.",
          );
        }
        const providerReq = provider as {
          request: (args: { method: string }) => Promise<string[] | string>;
        };
        const accounts = (await providerReq.request({
          method: "eth_requestAccounts",
        })) as string[];
        const address = accounts[0];
        const evmChainId = (await providerReq.request({
          method: "eth_chainId",
        })) as string;

        // Validate EVM network matches Starknet network before calling SDK
        const expectedNetwork = STARKNET_TO_EVM[chainId as unknown as string];
        if (expectedNetwork && evmChainId.toLowerCase() !== expectedNetwork.chainId.toLowerCase()) {
          const actualName = getEvmNetworkName(evmChainId.toLowerCase());
          throw new Error(
            `Network mismatch: MetaMask is on ${actualName} but your Starknet wallet is on ${expectedNetwork.starknetName}.\nPlease switch MetaMask to ${expectedNetwork.name}.`,
          );
        }

        extWallet = await ConnectedEthereumWallet.from(
          {
            chain: ExternalChain.ETHEREUM,
            provider,
            address,
            chainId: evmChainId,
          },
          chainId,
        ).catch((err: unknown) => {
          // Re-throw SDK network-mismatch errors with the same actionable format
          // as our pre-validation above so the UI can offer a switch button.
          const msg = err instanceof Error ? err.message : String(err);
          if (/mainnet|sepolia|testnet|network|chain/i.test(msg)) {
            const actualName = getEvmNetworkName(evmChainId.toLowerCase());
            const starknetName = expectedNetwork?.starknetName ?? "your Starknet network";
            const expectName = expectedNetwork?.name ?? "the correct Ethereum network";
            throw new Error(
              `Network mismatch: MetaMask is on ${actualName} but your Starknet wallet is on ${starknetName}.\nPlease switch MetaMask to ${expectName}.`,
            );
          }
          throw err;
        });
      } else if (token.chain === ExternalChain.SOLANA) {
        const provider = getSolanaProvider();
        if (!provider) {
          throw new Error("No Solana wallet detected. Install Phantom or another Solana wallet.");
        }
        // Phantom-style connect
        const phantomConnect = provider as unknown as {
          connect?: () => Promise<{ publicKey: { toString: () => string } }>;
          publicKey?: { toString: () => string };
        };
        let address: string;
        if (phantomConnect.connect) {
          const resp = await phantomConnect.connect();
          address = resp.publicKey.toString();
        } else if (phantomConnect.publicKey) {
          address = phantomConnect.publicKey.toString();
        } else {
          throw new Error("Could not get Solana address from wallet provider");
        }

        extWallet = await ConnectedSolanaWallet.from(
          {
            chain: ExternalChain.SOLANA,
            provider,
            address,
            chainId: "solana", // SDK resolves mainnet/testnet from starknetChain
          },
          chainId,
        );
      } else {
        throw new Error(`Unsupported chain: ${String(token.chain)}`);
      }

      // ── Fetch balance, allowance, fee in parallel ──────────────
      const [balResult, allowResult, feeResult] = await Promise.allSettled([
        wallet.getDepositBalance(token, extWallet),
        wallet.getAllowance(token, extWallet),
        wallet.getDepositFeeEstimate(token, extWallet, opts),
      ]);

      if (balResult.status === "rejected") {
        throw new Error(`Failed to fetch balance: ${balResult.reason}`);
      }
      if (feeResult.status === "rejected") {
        throw new Error(`Failed to estimate fees: ${feeResult.reason}`);
      }

      return {
        externalWallet: extWallet,
        available: balResult.value,
        allowance: allowResult.status === "fulfilled" ? (allowResult.value as Amount | null) : null,
        fees: feeResult.value,
      };
    },
  });

  return {
    data: query.data,
    isFetching: query.isFetching,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
    reset: () => {
      // Directly invoke the wallet's connect method — bypasses TanStack Query
      // caching entirely so MetaMask / Phantom opens immediately.
      // Once the user approves, we refetch to get fresh balance + fees.
      if (token?.chain === ExternalChain.ETHEREUM) {
        const provider = getEvmProvider();
        if (provider) {
          const p = provider as {
            request: (a: { method: string }) => Promise<unknown>;
          };
          void p
            .request({ method: "eth_requestAccounts" })
            .then(() => void query.refetch())
            .catch(() => void query.refetch());
          return;
        }
      }
      if (token?.chain === ExternalChain.SOLANA) {
        const provider = getSolanaProvider();
        if (provider) {
          const phantom = provider as unknown as {
            connect?: () => Promise<unknown>;
          };
          if (phantom.connect) {
            void phantom
              .connect()
              .then(() => void query.refetch())
              .catch(() => void query.refetch());
            return;
          }
        }
      }
      void query.refetch();
    },
  };
}
