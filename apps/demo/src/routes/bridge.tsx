import { useState, useMemo, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  useBridge,
  useAllBridgeTokens,
  useBridgeInfo,
  useWallet,
  Amount,
  fromAddress,
  BridgeToken,
} from "@dngbuilds/zapkit-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";

import { DataTable } from "@/components/data-table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/bridge")({
  component: BridgePage,
});

// ─── Helpers ───────────────────────────────────────────────────────

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const CHAIN_META: Record<string, { label: string; icon: string }> = {
  ethereum: { label: "Ethereum", icon: "⟠" },
  solana: { label: "Solana", icon: "◎" },
};

function getChainMeta(chain: string) {
  return CHAIN_META[chain] ?? { label: chain, icon: "🔗" };
}

// ─── Row type for bridge table ─────────────────────────────────────

interface BridgeRow {
  id: string;
  chain: string;
  chainLabel: string;
  chainIcon: string;
  symbol: string;
  name: string;
  decimals: number;
  protocol: string;
  address: string;
  starknetAddress: string;
  token: BridgeToken; // raw token for deposit calls
}

// ─── Column builder ────────────────────────────────────────────────

function buildColumns(
  isConnected: boolean,
  onDeposit: (row: BridgeRow) => void,
): ColumnDef<BridgeRow>[] {
  return [
    {
      id: "chain",
      header: "Chain",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="text-lg">{row.original.chainIcon}</span>
          <span className="text-sm font-medium">{row.original.chainLabel}</span>
        </div>
      ),
    },
    {
      id: "token",
      header: "Bridge Token",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold">
            {row.original.symbol.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-medium">{row.original.symbol}</p>
            <p className="text-[10px] text-muted-foreground">{row.original.name}</p>
          </div>
        </div>
      ),
    },
    {
      id: "protocol",
      header: "Protocol",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs capitalize">
          {row.original.protocol}
        </Badge>
      ),
    },
    {
      id: "address",
      header: "Address",
      cell: ({ row }) => (
        <code className="text-xs font-mono text-muted-foreground">
          {shortenAddress(row.original.address)}
        </code>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button size="sm" onClick={() => onDeposit(row.original)} disabled={!isConnected}>
          Deposit
        </Button>
      ),
    },
  ];
}

// ─── Page component ────────────────────────────────────────────────

function BridgePage() {
  "use no memo";
  const { status } = useWallet();
  const isConnected = status === "connected";
  const { deposit, isDepositing, depositError } = useBridge();
  const tokensQuery = useAllBridgeTokens();

  // Sheet state — only tracks which token is selected
  const [depositOpen, setDepositOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<BridgeRow | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<string>("");

  // ─── Build rows (memoised to avoid DataTable re-renders) ─────
  const rows: BridgeRow[] = useMemo(
    () =>
      (tokensQuery.data ?? []).map((token) => {
        const chain = String(token.chain);
        const meta = getChainMeta(chain);
        return {
          id: token.id ?? `${chain}-${token.symbol}`,
          chain,
          chainLabel: meta.label,
          chainIcon: meta.icon,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          protocol: String(token.protocol),
          address: String(token.address),
          starknetAddress: String(token.starknetAddress),
          token,
        };
      }),
    [tokensQuery.data],
  );

  const openDeposit = useCallback((row: BridgeRow) => {
    setSelectedToken(row);
    setSelectedAmount("");
    setDepositOpen(true);
  }, []);

  const columns = useMemo(() => buildColumns(isConnected, openDeposit), [isConnected, openDeposit]);

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Bridge tokens table ─── */}
      <Card>
        <CardHeader>
          <CardTitle>Bridgeable Tokens</CardTitle>
          <CardDescription>
            {rows.length > 0
              ? `${rows.length} token${rows.length !== 1 ? "s" : ""} available for bridging`
              : "Loading bridge tokens…"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tokensQuery.isLoading && rows.length === 0 ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <DataTable columns={columns} data={rows} emptyMessage="No bridge tokens available" />
          )}
        </CardContent>
      </Card>

      {/* ─── Deposit Sheet ─── */}
      <Sheet open={depositOpen} onOpenChange={setDepositOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Deposit {selectedToken?.symbol ?? "Token"} → Starknet</SheetTitle>
            <SheetDescription>
              Bridge {selectedToken?.symbol} from{" "}
              {selectedToken ? getChainMeta(selectedToken.chain).label : "external chain"} to your
              Starknet wallet
            </SheetDescription>
          </SheetHeader>

          {selectedToken?.token && (
            <DepositForm
              bridgeToken={selectedToken.token}
              chain={selectedToken.chain}
              symbol={selectedToken.symbol}
              decimals={selectedToken.decimals}
              protocol={selectedToken.protocol}
              deposit={deposit}
              isDepositing={isDepositing}
              depositError={depositError}
              onSuccess={() => setDepositOpen(false)}
              initialAmount={selectedAmount}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Deposit Form (self-contained) ────────────────────────────────

interface DepositFormProps {
  bridgeToken: BridgeToken;
  chain: string;
  symbol: string;
  decimals: number;
  protocol: string;
  deposit: ReturnType<typeof useBridge>["deposit"];
  isDepositing: boolean;
  depositError: Error | null;
  onSuccess: () => void;
  initialAmount?: string;
}

function DepositForm({
  bridgeToken,
  chain,
  symbol,
  decimals,
  protocol,
  deposit,
  isDepositing,
  depositError,
  onSuccess,
  initialAmount,
}: DepositFormProps) {
  const { wallet } = useWallet();
  const {
    data: info,
    isFetching,
    error,
    refetch,
    reset,
  } = useBridgeInfo(bridgeToken, { fastTransfer: true });

  const [depositAmount, setDepositAmount] = useState(initialAmount ?? "");

  const starknetAddress = wallet?.address ? String(wallet.address) : null;
  const chainMeta = getChainMeta(chain);

  // External wallet address from hook data
  const extWalletAddress = info?.externalWallet
    ? String(
        (info.externalWallet as { address?: { toString(): string } }).address?.toString() ?? "",
      )
    : null;

  // Balance
  const balanceFormatted = info?.available?.toFormatted(true) ?? null;
  const balanceUnit = info?.available?.toUnit() ?? null;

  // Allowance
  const allowanceFormatted = info?.allowance?.toFormatted(true) ?? null;

  // Validation
  const parsedInput = Number(depositAmount);
  const isValidAmount = depositAmount !== "" && !Number.isNaN(parsedInput) && parsedInput > 0;
  const exceedsBalance = isValidAmount && balanceUnit != null && parsedInput > Number(balanceUnit);
  const canDeposit = isValidAmount && !exceedsBalance && !!info?.externalWallet;

  async function handleDeposit() {
    if (!info?.externalWallet || !canDeposit) return;
    try {
      const walletAddr = wallet?.address;
      if (!walletAddr) throw new Error("Starknet wallet address not found");
      const parsedAmount = Amount.parse(depositAmount, decimals, symbol);
      const tx = await deposit({
        recipient: fromAddress(String(walletAddr)),
        amount: parsedAmount,
        token: bridgeToken,
        externalWallet: info.externalWallet,
      });
      setDepositAmount("");
      toast.success("Deposit submitted!", {
        description: `Bridging ${depositAmount} ${symbol} to Starknet. Tx: ${String(tx.hash).slice(0, 12)}…`,
      });
      refetch();
      onSuccess();
    } catch (err) {
      toast.error("Deposit failed", {
        description: (err as Error)?.message ?? "Transaction rejected or failed",
      });
    }
  }

  // ─── Loading state (auto-connecting wallet + fetching) ───────
  if (isFetching) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-8">
        <Spinner className="h-6 w-6" />
        <p className="text-sm text-muted-foreground">
          Connecting {chainMeta.icon} {chainMeta.label} wallet and loading info…
        </p>
      </div>
    );
  }

  // ─── Missing wallet extension prompt ─────────────────────────
  const isWalletMissing =
    error?.message?.includes("No Ethereum wallet detected") ||
    error?.message?.includes("No Solana wallet detected");

  // ─── Network mismatch prompt ─────────────────────────────
  const isNetworkMismatch =
    error?.message?.includes("Network mismatch:") ||
    // Catch the SDK's raw message as a safety net
    /cannot be used with/i.test(error?.message ?? "");
  // Extract the required network name from error, e.g. "Ethereum Sepolia"
  const requiredNetworkMatch = error?.message?.match(/switch MetaMask to (.+)\.$/);
  const requiredEvmNetwork = requiredNetworkMatch?.[1] ?? null;
  // Map human name → chainId hex for wallet_switchEthereumChain
  const NETWORK_HEX: Record<string, string> = {
    "Ethereum Mainnet": "0x1",
    "Ethereum Sepolia": "0xaa36a7",
  };
  const switchChainHex = requiredEvmNetwork ? (NETWORK_HEX[requiredEvmNetwork] ?? null) : null;

  async function handleSwitchNetwork() {
    if (!switchChainHex) return;
    try {
      const eth = (window as unknown as Record<string, unknown>).ethereum as {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      };
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: switchChainHex }],
      });
      reset();
    } catch {
      // Ignore — user may have cancelled or chain not added yet
    }
  }

  if (isNetworkMismatch) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
        <span className="text-3xl">🔗</span>
        <p className="text-sm font-medium">Wrong network</p>
        <p className="text-xs text-muted-foreground max-w-65 whitespace-pre-line">
          {error?.message}
        </p>
        {switchChainHex && (
          <Button variant="default" size="sm" onClick={handleSwitchNetwork}>
            Switch to {requiredEvmNetwork}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={reset}>
          I switched — retry
        </Button>
      </div>
    );
  }

  if (isWalletMissing) {
    const isEth = chain === "ethereum";
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
        <span className="text-3xl">{isEth ? "🦊" : "👻"}</span>
        <p className="text-sm font-medium">{isEth ? "Ethereum" : "Solana"} wallet not found</p>
        <p className="text-xs text-muted-foreground max-w-65">
          {isEth
            ? "Install MetaMask or another EIP-1193 browser wallet to deposit from Ethereum."
            : "Install Phantom or another Solana browser wallet to deposit from Solana."}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            window.open(
              isEth ? "https://metamask.io/download/" : "https://phantom.app/download",
              "_blank",
            )
          }
        >
          Install {isEth ? "MetaMask" : "Phantom"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          I already installed — retry
        </Button>
      </div>
    );
  }

  // ─── Other error state ───────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-6">
        <p className="text-sm text-destructive text-center">{error.message}</p>
        <Button variant="outline" size="sm" onClick={reset}>
          Try Again
        </Button>
      </div>
    );
  }

  // ─── Connected — show deposit form ───────────────────────────
  if (!info) return null;

  return (
    <div className="flex flex-col gap-4 px-4">
      {/* From / To addresses */}
      <div className="rounded-lg border p-3 flex flex-col gap-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">From</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs">
              {chainMeta.icon} {extWalletAddress ? shortenAddress(extWalletAddress) : "—"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[10px] text-muted-foreground"
              onClick={reset}
              title="Switch wallet"
            >
              ↻
            </Button>
          </div>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">To</span>
          <span className="font-mono text-xs">
            ◆ {starknetAddress ? shortenAddress(starknetAddress) : "—"}
          </span>
        </div>
      </div>

      {/* Allowance info */}
      {allowanceFormatted != null && (
        <div className="text-xs text-muted-foreground">
          Allowance: <span className="font-mono">{allowanceFormatted}</span>
        </div>
      )}

      {/* Amount input */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="deposit-amount">Amount ({symbol})</Label>
          {balanceFormatted != null ? (
            <span className="text-xs text-muted-foreground">
              Balance: <span className="font-mono">{balanceFormatted}</span>
            </span>
          ) : null}
        </div>
        <div className="relative">
          <Input
            id="deposit-amount"
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            className={exceedsBalance ? "border-destructive pr-16" : "pr-16"}
          />
          {balanceUnit != null && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-xs"
              onClick={() => setDepositAmount(balanceUnit)}
            >
              MAX
            </Button>
          )}
        </div>
        {exceedsBalance && (
          <p className="text-xs text-destructive">
            Insufficient balance. You have {balanceFormatted}.
          </p>
        )}
        {depositAmount !== "" && !isValidAmount && (
          <p className="text-xs text-destructive">Enter a valid amount greater than 0.</p>
        )}
      </div>

      {/* Summary */}
      {isValidAmount && (
        <>
          <Separator />
          <div className="rounded-lg border p-3 flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Estimated Received</span>
              <span className="font-mono">
                ~{depositAmount} {symbol}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Fee</span>
              {info.fees ? (
                <span className="font-mono text-xs">
                  {"fee" in info.fees
                    ? String((info.fees as Record<string, unknown>).fee)
                    : "localFee" in info.fees
                      ? `${String((info.fees as Record<string, unknown>).localFee)} + ${String((info.fees as Record<string, unknown>).interchainFee)}`
                      : JSON.stringify(info.fees)}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Protocol</span>
              <Badge variant="secondary" className="text-xs capitalize">
                {protocol}
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Deposit will bridge tokens from {chainMeta.label} to your Starknet address. This may
              take several minutes.
            </p>
          </div>
        </>
      )}

      {depositError && <p className="text-sm text-destructive">{depositError.message}</p>}

      {/* Deposit button */}
      <SheetFooter>
        <Button onClick={handleDeposit} disabled={isDepositing || !canDeposit} className="w-full">
          {isDepositing ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Depositing…
            </>
          ) : (
            `Deposit ${symbol}`
          )}
        </Button>
      </SheetFooter>
    </div>
  );
}
