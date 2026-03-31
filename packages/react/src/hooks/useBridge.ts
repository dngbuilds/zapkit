import { useMutation, useQuery } from "@tanstack/react-query";
import { useZapContext } from "../context";
import {
  type BridgeDepositOptions,
  type ExternalTransactionResponse,
  type Amount,
  type Address,
  type BridgeToken,
  type ConnectedExternalWallet,
  ConnectedEthereumWallet,
  ExternalChain,
  type ConnectEthereumWalletOptions,
  type ConnectSolanaWalletOptions,
  ConnectedSolanaWallet,
  type ExternalAddress,
} from "starkzap";

// ─── Standalone token query hooks ─────────────────────────────────
// Each hook owns exactly one query. Consumers only subscribe to what
// they render — no extra fetches when unrelated components mount.

export function useAllBridgeTokens() {
  const { sdk } = useZapContext();
  return useQuery({
    queryKey: ["bridge", "tokens"],
    queryFn: () => sdk!.getBridgingTokens(),
    enabled: !!sdk,
    staleTime: 5 * 60_000,
  });
}

export function useEthereumBridgeTokens() {
  const { sdk } = useZapContext();
  return useQuery({
    queryKey: ["bridge", "tokens", "ethereum"],
    queryFn: () => sdk!.getBridgingTokens(ExternalChain.ETHEREUM),
    enabled: !!sdk,
    staleTime: 5 * 60_000,
  });
}

export function useSolanaBridgeTokens() {
  const { sdk } = useZapContext();
  return useQuery({
    queryKey: ["bridge", "tokens", "solana"],
    queryFn: () => sdk!.getBridgingTokens(ExternalChain.SOLANA),
    enabled: !!sdk,
    staleTime: 5 * 60_000,
  });
}

// ─── Bridge hook — mutation + wallet helpers only ─────────────────
// No token queries here. Use useAllBridgeTokens / useEthereumBridgeTokens
// / useSolanaBridgeTokens in the component that needs them.

/**
 * Bridge hook — deposit mutation + wallet connection helpers.
 *
 * Token discovery is intentionally split into standalone hooks
 * (`useAllBridgeTokens`, `useEthereumBridgeTokens`, `useSolanaBridgeTokens`)
 * so components only subscribe to the queries they actually need.
 *
 * Follows the official starkzap bridging flow:
 * 1. Discover  — `useAllBridgeTokens()` / chain-specific variants
 * 2. Inspect   — `wallet.getDepositBalance(token, extWallet)`
 * 3. Allowance — `wallet.getAllowance(token, extWallet)`
 * 4. Estimate  — `wallet.getDepositFeeEstimate(token, extWallet, opts?)`
 * 5. Deposit   — `bridge.deposit({ recipient, amount, token, externalWallet })`
 */
export function useBridge() {
  const { wallet, sdk } = useZapContext();

  const getEthWallet = async (options: ConnectEthereumWalletOptions) => {
    if (!sdk) throw new Error("SDK not initialized");
    if (!wallet?.getChainId()) throw new Error("Wallet not connected");
    const ethWallet = await ConnectedEthereumWallet.from(
      { ...options, chain: ExternalChain.ETHEREUM },
      wallet.getChainId(),
    );
    if (ethWallet instanceof ConnectedEthereumWallet) return ethWallet;
    throw new Error("No Ethereum wallet connected");
  };

  const getSolanaWallet = async (options: ConnectSolanaWalletOptions) => {
    if (!sdk) throw new Error("SDK not initialized");
    if (!wallet?.getChainId()) throw new Error("Wallet not connected");
    const solWallet = await ConnectedSolanaWallet.from(
      { ...options, chain: ExternalChain.SOLANA },
      wallet.getChainId(),
    );
    if (solWallet instanceof ConnectedSolanaWallet) return solWallet;
    throw new Error("No Solana wallet connected");
  };

  const getDepositBalance = async (
    token: BridgeToken<ExternalAddress>,
    externalWallet: ConnectedExternalWallet,
  ) => {
    if (!wallet?.getChainId()) throw new Error("Wallet not connected");
    return await wallet.getDepositBalance(token, externalWallet);
  };

  const getAllowance = async (
    token: BridgeToken<ExternalAddress>,
    externalWallet: ConnectedExternalWallet,
  ) => {
    if (!wallet?.getChainId()) throw new Error("Wallet not connected");
    return await wallet.getAllowance(token, externalWallet);
  };

  const getFeeEstimate = async (
    token: BridgeToken<ExternalAddress>,
    externalWallet: ConnectedExternalWallet,
    options?: Partial<BridgeDepositOptions>,
  ) => {
    if (!wallet?.getChainId()) throw new Error("Wallet not connected");
    return await wallet.getDepositFeeEstimate(token, externalWallet, options);
  };

  const depositMutation = useMutation<
    ExternalTransactionResponse,
    Error,
    {
      externalWallet: ConnectedExternalWallet;
      recipient: Address;
      amount: Amount;
      token: BridgeToken;
      options?: BridgeDepositOptions;
    }
  >({
    mutationFn: async ({ token, externalWallet, recipient, amount, options }) => {
      if (!wallet) throw new Error("Wallet not connected.");
      if (!token) throw new Error("No bridge token selected.");
      return await wallet.deposit(recipient, amount, token, externalWallet, options);
    },
  });

  return {
    getEthWallet,
    getSolanaWallet,
    getDepositBalance,
    getAllowance,
    getFeeEstimate,
    deposit: depositMutation.mutateAsync,
    depositMutation,
    isDepositing: depositMutation.isPending,
    depositError: depositMutation.error,
  };
}
