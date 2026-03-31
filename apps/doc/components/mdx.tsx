import defaultMdxComponents from "fumadocs-ui/mdx";
import {
  ComponentPreview,
  ConnectWalletButtonPreview,
  AddressBadgePreview,
  NetworkBadgePreview,
  TokenAmountPreview,
  TransactionStatusPreview,
  WalletCardPreview,
} from "./preview";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMDXComponents(components: Record<string, any> = {}): Record<string, any> {
  return {
    ...defaultMdxComponents,
    ComponentPreview,
    ConnectWalletButtonPreview,
    AddressBadgePreview,
    NetworkBadgePreview,
    TokenAmountPreview,
    TransactionStatusPreview,
    WalletCardPreview,
    ...components,
  };
}
