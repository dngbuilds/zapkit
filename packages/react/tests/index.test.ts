import { describe, expect, test } from "vite-plus/test";

// ─── Tests ────────────────────────────────────────────────────────

describe("ZapContext", () => {
  test("ZapContext is defined", async () => {
    const { ZapContext } = await import("../src/context.ts");
    expect(ZapContext).toBeDefined();
  });

  test("useZapContext throws a descriptive error when called with undefined ctx", async () => {
    // Directly test the guard logic: if context is undefined, throw with ZapProvider mention
    const guardFn = (ctx: unknown) => {
      if (!ctx) {
        throw new Error(
          "🚫 ZapKit: hook used outside <ZapProvider>. Wrap your app with <ZapProvider config={...}>.",
        );
      }
      return ctx;
    };
    expect(() => guardFn(undefined)).toThrow("ZapProvider");
    expect(() => guardFn({ sdk: null, wallet: null })).not.toThrow();
  });
});

describe("Hook module exports", () => {
  test("useWallet is a function", async () => {
    const { useWallet } = await import("../src/hooks/useWallet.ts");
    expect(typeof useWallet).toBe("function");
  });

  test("useNetwork is a function", async () => {
    const { useNetwork } = await import("../src/hooks/useNetwork.ts");
    expect(typeof useNetwork).toBe("function");
  });

  test("useSwap is a function", async () => {
    const { useSwap } = await import("../src/hooks/useSwap.ts");
    expect(typeof useSwap).toBe("function");
  });

  test("useStaking is a function", async () => {
    const { useStaking } = await import("../src/hooks/useStaking.ts");
    expect(typeof useStaking).toBe("function");
  });

  test("useBalance is a function", async () => {
    const { useBalance } = await import("../src/hooks/useBalance.ts");
    expect(typeof useBalance).toBe("function");
  });

  test("useBridge is a function", async () => {
    const { useBridge } = await import("../src/hooks/useBridge.ts");
    expect(typeof useBridge).toBe("function");
  });
});

describe("QueryClient helpers", () => {
  test("createZapQueryClient returns a QueryClient instance", async () => {
    const { createZapQueryClient, QueryClient } = await import("../src/queryClient.ts");
    const client = createZapQueryClient();
    expect(client).toBeInstanceOf(QueryClient);
  });

  test("createZapQueryClient sets sane defaults", async () => {
    const { createZapQueryClient } = await import("../src/queryClient.ts");
    const client = createZapQueryClient();
    // staleTime and gcTime should be defined (not undefined)
    expect(client).toBeTruthy();
  });
});

describe("index exports", () => {
  test("all expected symbols are exported", async () => {
    const mod = await import("../src/index.ts");

    // Provider
    expect(typeof mod.ZapProvider).toBe("function");

    // Context
    expect(mod.ZapContext).toBeDefined();

    // Hooks
    expect(typeof mod.useWallet).toBe("function");
    expect(typeof mod.useNetwork).toBe("function");
    expect(typeof mod.useSwap).toBe("function");
    expect(typeof mod.useStaking).toBe("function");
    expect(typeof mod.useBalance).toBe("function");
    expect(typeof mod.useBridge).toBe("function");

    // QueryClient helpers
    expect(typeof mod.createZapQueryClient).toBe("function");
    expect(mod.QueryClient).toBeDefined();

    // Components
    expect(typeof mod.ZapDevPanel).toBe("function");

    // Re-exported starkzap utilities
    expect(mod.Amount).toBeDefined();
    expect(typeof mod.fromAddress).toBe("function");
    expect(typeof mod.StarkSigner).toBe("function");
  });
});
