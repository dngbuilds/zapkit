import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useZapContext, useWallet } from "@dngbuilds/zapkit-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const ETH_ADDRESS = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";

function SendPage() {
  const { sdk, wallet: connectedWallet } = useZapContext();
  const { wallet, status } = useWallet();
  const address = wallet?.address ? String(wallet.address) : null;
  const isConnected = status === "connected";

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");

  const balanceQuery = useMutation({
    mutationFn: async ({ to, value }: { to: string; value: string }) => {
      if (!sdk) throw new Error("SDK not initialized");
      if (!connectedWallet) throw new Error("No wallet connected");

      const result = await sdk.callContract({
        contractAddress: ETH_ADDRESS,
        entrypoint: "balanceOf",
        calldata: [address ?? "0x0"],
      });

      return {
        query: { to, value },
        result,
        note: "Full transfer requires wallet.execute — this demonstrates useZapContext() raw access.",
      };
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Send / Transfer</CardTitle>
          <CardDescription>
            Uses raw <code className="text-xs">useZapContext()</code> SDK instance for direct
            contract interaction via <code className="text-xs">useMutation</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConnected ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="sender">From</Label>
                <Input id="sender" value={address ?? ""} disabled className="font-mono text-xs" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recipient">Recipient Address</Label>
                <Input
                  id="recipient"
                  placeholder="0x..."
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="send-amount">Amount (ETH, raw wei)</Label>
                <Input
                  id="send-amount"
                  placeholder="e.g. 1000000000000000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <Button
                onClick={() => balanceQuery.mutate({ to: recipient, value: amount })}
                disabled={balanceQuery.isPending || !recipient || !amount}
              >
                {balanceQuery.isPending ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Querying…
                  </>
                ) : (
                  "Query Balance & Test"
                )}
              </Button>

              {balanceQuery.error && (
                <p className="text-sm text-destructive">{balanceQuery.error.message}</p>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-10 w-28" />
            </div>
          )}
        </CardContent>
      </Card>

      {balanceQuery.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-auto max-h-48 whitespace-pre-wrap">
              {JSON.stringify(balanceQuery.data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* SDK Instance Debug */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">useZapContext() Debug</CardTitle>
          <CardDescription>Shows whether the raw SDK instance is available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Badge variant={sdk ? "default" : "secondary"}>
              {sdk ? "SDK Ready" : "Not Initialized"}
            </Badge>
            {sdk && (
              <Badge variant="outline">Wallet: {connectedWallet ? "Connected" : "None"}</Badge>
            )}
            <Badge variant={balanceQuery.isIdle ? "secondary" : "outline"}>
              {balanceQuery.isPending
                ? "Pending"
                : balanceQuery.isSuccess
                  ? "Success"
                  : balanceQuery.isError
                    ? "Error"
                    : "Idle"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/send")({
  component: SendPage,
});
