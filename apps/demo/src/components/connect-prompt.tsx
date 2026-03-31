import { useWallet } from "@dngbuilds/zapkit-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function ConnectPrompt({ message }: { message?: string }) {
  const { connectCartridge, isLoading } = useWallet();

  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <p className="text-sm text-muted-foreground">
        {message ?? "Connect your wallet to access this feature"}
      </p>
      <Button size="sm" disabled={isLoading} onClick={() => connectCartridge()}>
        {isLoading ? (
          <>
            <Spinner className="mr-2 h-3.5 w-3.5" />
            Connecting…
          </>
        ) : (
          "Connect Wallet"
        )}
      </Button>
    </div>
  );
}
