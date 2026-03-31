"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";

export type TxStatus = "idle" | "pending" | "success" | "error";

export interface TransactionStatusProps {
  status: TxStatus;
  /** Optional transaction hash for a block-explorer link */
  txHash?: string | null;
  /** Optional block explorer base URL, e.g. "https://starkscan.co/tx/" */
  explorerUrl?: string;
  /** Override the default status message */
  message?: string | null;
  className?: string;
}

const DEFAULT_MESSAGES: Record<TxStatus, string> = {
  idle: "",
  pending: "Transaction pending…",
  success: "Transaction confirmed!",
  error: "Transaction failed.",
};

/**
 * Displays transaction state as an inline alert — spinner while pending,
 * check when confirmed, error when failed.
 *
 * @example
 * ```tsx
 * const { stake, status, txHash } = useStaking();
 * <TransactionStatus status={status} txHash={txHash} />
 * ```
 */
export function TransactionStatus({
  status,
  txHash,
  explorerUrl = "https://starkscan.co/tx/",
  message,
  className,
}: TransactionStatusProps) {
  if (status === "idle") return null;

  const text = message ?? DEFAULT_MESSAGES[status];

  return (
    <Alert
      variant={status === "error" ? "destructive" : "default"}
      className={cn("flex items-center gap-3 py-3", className)}
    >
      {status === "pending" && <Spinner className="size-4 shrink-0" />}
      {status === "success" && (
        <HugeiconsIcon
          icon={CheckmarkCircle01Icon}
          className="size-4 shrink-0 text-emerald-500"
          strokeWidth={2}
          aria-hidden
        />
      )}
      {status === "error" && (
        <HugeiconsIcon
          icon={Cancel01Icon}
          className="size-4 shrink-0 text-destructive"
          strokeWidth={2}
          aria-hidden
        />
      )}
      <AlertDescription className="text-sm">
        {text}
        {status === "success" && txHash && (
          <a
            href={`${explorerUrl}${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="ml-2 underline underline-offset-2 text-primary hover:no-underline"
          >
            View on explorer ↗
          </a>
        )}
      </AlertDescription>
    </Alert>
  );
}
