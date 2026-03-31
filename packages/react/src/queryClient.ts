import { QueryClient } from "@tanstack/react-query";

/**
 * Creates a pre-configured `QueryClient` suitable for ZapKit blockchain queries.
 *
 * Sensible defaults:
 * - `staleTime`: 30 s (blocks don't update instantly)
 * - `gcTime`: 5 min
 * - `retry`: 2
 * - `refetchOnWindowFocus`: false (avoids noisy refetches on tab switch)
 *
 * Pass to `<QueryClientProvider>` when you want to share a single client
 * across your app AND ZapKit:
 *
 * @example
 * const queryClient = createZapQueryClient();
 *
 * <QueryClientProvider client={queryClient}>
 *   <ZapProvider config={config} queryClient={queryClient}>
 *     <App />
 *   </ZapProvider>
 * </QueryClientProvider>
 */
export function createZapQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 2,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export { QueryClient };
