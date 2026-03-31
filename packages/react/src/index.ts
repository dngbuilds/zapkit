// ─── Re-export starkzap types useful for consumers ────────────────
export type {
  OnboardOptions,
  OnboardResult,
  Token,
  Pool,
  PoolMember,
  Validator,
  Address,
  CartridgeWalletInterface,
  ConnectCartridgeBaseOptions,
  EnsureReadyOptions,
  ExecuteOptions,
  RpcProvider,
  Call,
  ConnectedExternalWallet,
  ConnectEthereumWalletOptions,
  BridgeDepositOptions,
  BridgeDepositFeeEstimation,
  ExternalTransactionResponse,
  Eip1193Provider,
  SDKConfig,
  SwapInput,
  SwapQuote,
  SwapRequest,
  SwapProvider,
  PreparedSwap,
} from "starkzap";
export {
  OnboardStrategy,
  Amount,
  fromAddress,
  StarkSigner,
  Tx,
  TxBuilder,
  ChainId,
  ExternalChain,
  BridgeToken,
  ConnectedEthereumWallet,
  ConnectedSolanaWallet,
  getPresets,
  accountPresets,
  mainnetValidators,
  sepoliaValidators,
  AvnuSwapProvider,
  EkuboSwapProvider,
  AvnuDcaProvider,
  EkuboDcaProvider,
} from "starkzap";

// ─── Provider ─────────────────────────────────────────────────────
export { ZapProvider } from "./provider";

// ─── Context & types ──────────────────────────────────────────────
export { ZapContext, useZapContext } from "./context";
export type { ZapContextValue, ConnectionStatus } from "./context";

// ─── Hooks ─────────────────────────────────────────────────────────
export { useWallet } from "./hooks/useWallet";
export { useNetwork } from "./hooks/useNetwork";
export { useBalance } from "./hooks/useBalance";
export {
  useSwap,
  useGetQuoteMutation,
  useGetQuoteQuery,
  useSwapMutation,
  usePresetTokens,
} from "./hooks/useSwap";
export {
  useDcaOrdersQuery,
  useCreateDcaMutation,
  useCancelDcaMutation,
  usePreviewDcaCycleMutation,
} from "./hooks/useDca";
export type {
  DcaOrder,
  DcaTrade,
  DcaOrdersPage,
  DcaCreateInput,
  DcaCancelInput,
} from "./hooks/useDca";
export {
  useStaking,
  useStakingTokens,
  useStakingPools,
  useStakeMutation,
  useAddToPoolMutation,
  useClaimRewardMutation,
  useExitIntentMutation,
  useExitPoolMutation,
} from "./hooks/useStaking";
export type { StakingPool } from "./hooks/useStaking";
export {
  useBridge,
  useAllBridgeTokens,
  useEthereumBridgeTokens,
  useSolanaBridgeTokens,
} from "./hooks/useBridge";
export { useBridgeInfo } from "./hooks/useBridgeInfo";
export type { BridgeInfo, UseBridgeInfoReturn } from "./hooks/useBridgeInfo";
export {
  useLendingMarketsQuery,
  useLendingUserPositionsQuery,
  useLendingPositionQuery,
  useLendingHealthQuery,
  useLendingDepositMutation,
  useLendingWithdrawMutation,
  useLendingWithdrawMaxMutation,
  useBorrowMutation,
  useRepayMutation,
} from "./hooks/useLending";
export type {
  LendingMarket,
  LendingPosition,
  LendingHealth,
  LendingDepositRequest,
  LendingWithdrawRequest,
  LendingWithdrawMaxRequest,
  LendingBorrowRequest,
  LendingRepayRequest,
  LendingPositionRequest,
  LendingHealthRequest,
  LendingUserPosition,
} from "./hooks/useLending";

// ─── Query client helpers ──────────────────────────────────────────
export { createZapQueryClient, QueryClient } from "./queryClient";

// ─── Components ───────────────────────────────────────────────────
export { ZapDevPanel } from "./components/ZapDevPanel";

// ─── ZapKit class (merged from @dngbuilds/zapkit-core) ───────────
export { default as ZapKit } from "./zapkit";
export type { ZapKitConfig, ConnectCartridgeOptions } from "./zapkit";
