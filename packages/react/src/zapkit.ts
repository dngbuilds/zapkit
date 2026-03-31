import {
  StarkZap,
  type SDKConfig,
  OnboardStrategy,
  StarkSigner,
  Amount,
  fromAddress,
  getPresets,
  accountPresets,
  type Wallet,
  type Token,
  type ConnectWalletOptions,
  type Address,
  type OnboardOptions,
  type OnboardResult,
  type EnsureReadyOptions,
  type Pool,
  type ExecuteOptions,
  Tx,
  TxBuilder,
  ExternalChain,
  BridgeToken,
  type RpcProvider,
  type Call,
  ChainId,
  type ConnectCartridgeBaseOptions,
  type CartridgeWalletInterface,
  mainnetValidators,
  sepoliaValidators,
  type PoolMember,
  ConnectedEthereumWallet,
  type ConnectEthereumWalletOptions,
  type BridgeDepositOptions,
  type BridgeDepositFeeEstimation,
  type ExternalTransactionResponse,
  type ConnectedExternalWallet,
  type Eip1193Provider,
} from "starkzap";
import type { CartridgeWallet } from "starkzap/cartridge";

/** A staking validator with its name, address, and logo. */
export interface Validator {
  name: string;
  stakerAddress: Address;
  logoUrl: URL | null;
}

// ConnectCartridgeOptions is defined in starkzap's sdk.d.ts as a local type;
// re-derive it from the SDK's onboard cartridge config union member.
export type ConnectCartridgeOptions = NonNullable<
  Extract<OnboardOptions, { strategy: "cartridge" }>["cartridge"]
> &
  ConnectCartridgeBaseOptions;

export interface ZapKitConfig extends SDKConfig {
  // will export more config options in the future, but for now we just want to allow passing the same config as StarkZap
}

const validatorsByNetwork: Record<string, Record<string, Validator>> = {
  mainnet: mainnetValidators,
  SN_MAIN: mainnetValidators,
  sepolia: sepoliaValidators,
  SN_SEPOLIA: sepoliaValidators,
};

export class ZapKit {
  private sdk: StarkZap;
  private currentWallet: Wallet | CartridgeWallet | null = null;

  // Cache the Cartridge wallet across disconnect→connect cycles.
  // Cartridge Controller is a page-level singleton — it embeds an iframe and
  // a postMessage channel that persist for the lifetime of the page. Creating
  // a SECOND Controller while the first is still alive causes init failures.
  // Instead, we reuse the existing Controller via controller.connect().
  private _cartridgeWallet: CartridgeWallet | null = null;

  private network: string;

  constructor(config: ZapKitConfig) {
    this.sdk = new StarkZap(config);
    this.network = String((config as any).network ?? "sepolia");
    console.log(`🚀 ZapKit initialized on ${this.network}`);
  }

  /** ==================== ONBOARD & WALLET ==================== */
  async onboard(params: OnboardOptions) {
    // Reuse an existing Cartridge Controller if available.
    // The Controller survives disconnect()→connect() cycles on the same
    // instance; creating a second one while the first's iframe is alive
    // causes "Cartridge Controller failed to initialize" errors.

    if (params.strategy === "cartridge" && this._cartridgeWallet) {
      // The cached wallet still has its address and Controller alive.
      // Just restore the reference — no need to call controller.connect()
      // which would open the Cartridge popup again for no reason.
      this.currentWallet = this._cartridgeWallet;
      return {
        wallet: this.currentWallet,
        strategy: params.strategy,
        deployed: await this.currentWallet.isDeployed(),
      } as OnboardResult;
    }

    const result = await this.sdk.onboard(params);
    this.currentWallet = result.wallet as unknown as Wallet;

    // Cache the Cartridge wallet for reuse on future connects.
    if (params.strategy === "cartridge") {
      this._cartridgeWallet = this.currentWallet as unknown as CartridgeWallet;
    }

    return result;
  }

  async connectWallet(options: ConnectWalletOptions) {
    const wallet = await this.sdk.connectWallet(options);
    this.currentWallet = wallet;
    return wallet;
  }

  getWallet(): Wallet | CartridgeWallet | null {
    return this.currentWallet;
  }

  async disconnect(): Promise<void> {
    if (this.currentWallet) {
      // For Cartridge wallets, skip calling wallet.disconnect().
      // The Cartridge Controller is a page-level singleton — its disconnect()
      // destroys the keychain iframe session, leaving it unable to reconnect
      // without a full page reload (Cartridge's own logout() calls reload()).
      // Instead we just clear our reference; the Controller stays connected
      // so controller.connect() returns the existing account instantly.
      if (this._cartridgeWallet === this.currentWallet) {
        this.currentWallet = null;
        return;
      }

      try {
        await this.currentWallet.disconnect();
      } catch {
        // Best-effort cleanup — don't block the caller if the
        // underlying provider (e.g. Cartridge iframe) already closed.
      }
      this.currentWallet = null;
    }
  }

  async ensureReady(options?: EnsureReadyOptions) {
    if (!this.currentWallet)
      throw new Error("Wallet not connected. Call onboard() or connectWallet() first.");
    await this.currentWallet.ensureReady(options);
  }

  /** ==================== VALIDATORS ==================== */
  /**
   * Returns the list of known staking validators for the configured network.
   * Each validator has a name, stakerAddress, and optional logoUrl.
   */
  getValidators(): Validator[] {
    const preset = validatorsByNetwork[this.network];
    return preset ? Object.values(preset) : [];
  }

  /** ==================== STAKING ==================== */
  async stakingTokens() {
    return this.sdk.stakingTokens();
  }

  async getStakerPools(staker: Address): Promise<Pool[]> {
    return this.sdk.getStakerPools(staker);
  }

  /**
   * Smart stake — auto-detects whether the user is a new or existing member.
   * Calls `enterPool` for first-time stakers, `addToPool` for existing members.
   * Waits for the transaction to be accepted.
   */
  async stake(params: {
    poolAddress: Address;
    amount: Amount;
    options?: ExecuteOptions;
  }): Promise<Tx> {
    if (!this.currentWallet) throw new Error("Wallet not connected.");
    const tx = await this.currentWallet.stake(params.poolAddress, params.amount, params.options);
    await tx.wait();
    return tx;
  }

  /**
   * Enter a delegation pool for the first time.
   * Use `stake()` instead if you don't want to branch on membership manually.
   */
  async enterPool(params: {
    poolAddress: Address;
    amount: Amount;
    options?: ExecuteOptions;
  }): Promise<Tx> {
    if (!this.currentWallet) throw new Error("Wallet not connected.");
    const tx = await this.currentWallet.enterPool(
      params.poolAddress,
      params.amount,
      params.options,
    );
    await tx.wait();
    return tx;
  }

  /**
   * Add more tokens to an existing delegation pool position.
   * Use `stake()` instead if you don't want to branch on membership manually.
   */
  async addToPool(params: {
    poolAddress: Address;
    amount: Amount;
    options?: ExecuteOptions;
  }): Promise<Tx> {
    if (!this.currentWallet) throw new Error("Wallet not connected.");
    const tx = await this.currentWallet.addToPool(
      params.poolAddress,
      params.amount,
      params.options,
    );
    await tx.wait();
    return tx;
  }

  /**
   * Claim accumulated staking rewards from a pool.
   * Waits for the transaction to be accepted.
   */
  async claimRewards(poolAddress: Address, options?: ExecuteOptions): Promise<Tx> {
    if (!this.currentWallet) throw new Error("Wallet not connected.");
    const tx = await this.currentWallet.claimPoolRewards(poolAddress, options);
    await tx.wait();
    return tx;
  }

  /**
   * Declare intent to exit (unstake) from a delegation pool.
   * Starts the exit cooldown window. After the window passes,
   * call `exitPool()` to finalize the withdrawal.
   */
  async exitPoolIntent(params: {
    poolAddress: Address;
    amount: Amount;
    options?: ExecuteOptions;
  }): Promise<Tx> {
    if (!this.currentWallet) throw new Error("Wallet not connected.");
    const tx = await this.currentWallet.exitPoolIntent(
      params.poolAddress,
      params.amount,
      params.options,
    );
    await tx.wait();
    return tx;
  }

  /**
   * Complete the exit from a delegation pool after the cooldown window
   * has passed (following a prior `exitPoolIntent`).
   */
  async exitPool(poolAddress: Address, options?: ExecuteOptions): Promise<Tx> {
    if (!this.currentWallet) throw new Error("Wallet not connected.");
    const tx = await this.currentWallet.exitPool(poolAddress, options);
    await tx.wait();
    return tx;
  }

  /** ==================== POOL POSITION ==================== */
  async getPoolPosition(poolAddress: Address): Promise<PoolMember | null> {
    if (!this.currentWallet) return null;
    return this.currentWallet.getPoolPosition(poolAddress);
  }

  async getPoolCommission(poolAddress: Address): Promise<number | null> {
    if (!this.currentWallet) return null;
    try {
      return await this.currentWallet.getPoolCommission(poolAddress);
    } catch {
      return null;
    }
  }

  /** ==================== BRIDGING ==================== */
  async getBridgingTokens(chain?: ExternalChain): Promise<BridgeToken[]> {
    return this.sdk.getBridgingTokens(chain);
  }

  /**
   * Connect an Ethereum external wallet for bridge operations.
   *
   * @example
   * const ethWallet = await kit.connectEthereumWallet({
   *   provider: window.ethereum, address: evmAddress, chainId: evmChainId,
   * });
   */
  async connectEthereumWallet(
    options: Omit<ConnectEthereumWalletOptions, "chain">,
  ): Promise<ConnectedEthereumWallet> {
    return ConnectedEthereumWallet.from(
      { ...options, chain: ExternalChain.ETHEREUM },
      this.network === "mainnet" || this.network === "SN_MAIN" ? ChainId.MAINNET : ChainId.SEPOLIA,
    );
  }

  /**
   * Get available deposit balance for a bridge token on the external chain.
   */
  async getDepositBalance(
    token: BridgeToken,
    externalWallet: ConnectedExternalWallet,
  ): Promise<Amount> {
    if (!this.currentWallet) throw new Error("Wallet not connected.");
    return this.currentWallet.getDepositBalance(token, externalWallet);
  }

  /**
   * Get the external chain ERC20 allowance for a bridge token (null for native).
   */
  async getAllowance(
    token: BridgeToken,
    externalWallet: ConnectedExternalWallet,
  ): Promise<Amount | null> {
    if (!this.currentWallet) throw new Error("Wallet not connected.");
    return this.currentWallet.getAllowance(token, externalWallet);
  }

  /**
   * Estimate the deposit fee for bridging a token from the external chain.
   */
  async getDepositFeeEstimate(
    token: BridgeToken,
    externalWallet: ConnectedExternalWallet,
    options?: BridgeDepositOptions,
  ): Promise<BridgeDepositFeeEstimation> {
    if (!this.currentWallet) throw new Error("Wallet not connected.");
    return this.currentWallet.getDepositFeeEstimate(token, externalWallet, options);
  }

  /**
   * Submit an external-chain → Starknet deposit transaction.
   *
   * @example
   * const tx = await kit.deposit({
   *   recipient: fromAddress("0x..."),
   *   amount: Amount.parse("0.1", 18, "ETH"),
   *   token: bridgeToken,
   *   externalWallet: ethWallet,
   * });
   */
  async deposit(params: {
    recipient: Address;
    amount: Amount;
    token: BridgeToken;
    externalWallet: ConnectedExternalWallet;
    options?: BridgeDepositOptions;
  }): Promise<ExternalTransactionResponse> {
    if (!this.currentWallet) throw new Error("Wallet not connected.");
    return this.currentWallet.deposit(
      params.recipient,
      params.amount,
      params.token,
      params.externalWallet,
      params.options,
    );
  }

  /** ==================== CARTRIDGE ==================== */
  /**
   * Connect using Cartridge Controller (social login / passkeys).
   * Requires `@cartridge/controller` to be installed as an app dependency.
   *
   * @example
   * const wallet = await kit.connectCartridge({ policies: [...] });
   */
  async connectCartridge(options?: ConnectCartridgeOptions): Promise<CartridgeWalletInterface> {
    const wallet = await this.sdk.connectCartridge(options);
    // CartridgeWallet implements WalletInterface which is Wallet-compatible
    this.currentWallet = wallet as unknown as Wallet;
    return wallet;
  }

  /** ==================== PROVIDER & CONTRACT ==================== */
  getProvider(): RpcProvider {
    return this.sdk.getProvider();
  }

  callContract(call: Call): ReturnType<RpcProvider["callContract"]> {
    return this.sdk.callContract(call);
  }

  /** ==================== UTILITIES ==================== */
  get utils() {
    return {
      Amount,
      fromAddress,
      getPresets,
      accountPresets,
      OnboardStrategy,
      StarkSigner,
    };
  }

  async getBalance(token: Token): Promise<Amount> {
    if (!this.currentWallet) throw new Error("Wallet not connected.");
    return this.currentWallet.balanceOf(token);
  }
}

// ─── Type-only exports (interfaces / mapped types) ─────────────────────────────
export type {
  SDKConfig,
  Wallet,
  Token,
  OnboardOptions,
  OnboardResult,
  ConnectWalletOptions,
  Address,
  Pool,
  PoolMember,
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
  StarkZap,
};
// ─── Value exports (enums, classes, functions) ───────────────────────────────
export {
  // Wallet strategies & signers
  OnboardStrategy,
  StarkSigner,
  // Token amounts
  Amount,
  fromAddress,
  // Account presets
  getPresets,
  accountPresets,
  // Transactions
  Tx,
  TxBuilder,
  // Network
  ChainId,
  // Bridging
  ExternalChain,
  BridgeToken,
  ConnectedEthereumWallet,
  // Validator presets
  mainnetValidators,
  sepoliaValidators,
};
export default ZapKit;
