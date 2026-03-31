import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { useZapContext } from "../context";
import {
  mainnetValidators,
  sepoliaValidators,
  type Validator,
  type Pool,
  type Address,
  type Amount,
  type PoolMember,
} from "starkzap";

/** A pool paired with its parent validator — one row per pool. */
export interface StakingPool {
  validator: Validator;
  pool: Pool;
}

const validatorsByNetwork: Record<string, Record<string, Validator>> = {
  mainnet: mainnetValidators,
  SN_MAIN: mainnetValidators,
  sepolia: sepoliaValidators,
  SN_SEPOLIA: sepoliaValidators,
};

// ─── Standalone query hooks ──────────────────────────────────────────────────────────────────
// Each hook owns exactly one query. Consumers only subscribe to what
// they render — no extra fetches when unrelated components mount.

/** Subscribe to the list of stakeable tokens. */
export function useStakingTokens() {
  const { sdk } = useZapContext();
  return useQuery({
    queryKey: ["staking", "tokens"],
    queryFn: () => sdk!.stakingTokens(),
    enabled: !!sdk,
    staleTime: 60_000,
  });
}

/** Subscribe to all staking pools across every validator on the current network. */
export function useStakingPools() {
  const { sdk, network } = useZapContext();
  const preset = validatorsByNetwork[network];
  const validators: Validator[] = preset ? Object.values(preset) : [];

  const poolQueries = useQueries({
    queries: validators.map((v) => ({
      queryKey: ["staking", "pools", v.stakerAddress],
      queryFn: async (): Promise<{ validator: Validator; pools: Pool[] }> => {
        try {
          const pools = await sdk!.getStakerPools(v.stakerAddress);
          return { validator: v, pools };
        } catch {
          return { validator: v, pools: [] };
        }
      },
      enabled: !!sdk,
      staleTime: 60_000,
    })),
  });

  const pools: StakingPool[] = [];
  for (const q of poolQueries) {
    if (q.data) {
      for (const pool of q.data.pools) {
        pools.push({ validator: q.data.validator, pool });
      }
    }
  }

  return {
    pools,
    validators,
    isLoading: poolQueries.some((q) => q.isLoading),
    isError: poolQueries.some((q) => q.isError),
    error: poolQueries.find((q) => q.isError)?.error ?? null,
    refetch: () => Promise.all(poolQueries.map((q) => q.refetch())),
  };
}

// ─── Standalone mutation hooks ─────────────────────────────────────────────────────────
// Each hook owns exactly one mutation with its own isPending / error state.

/** Stake tokens into a pool (auto-detects enter vs. add-to-existing). */
export function useStakeMutation() {
  const { wallet } = useZapContext();
  const m = useMutation({
    mutationFn: async (params: { poolAddress: Address; amount: Amount }) => {
      if (!wallet) throw new Error("Wallet not connected.");
      const tx = await wallet.stake(params.poolAddress, params.amount);
      await tx.wait();
      return tx;
    },
  });
  return { stake: m.mutateAsync, isStaking: m.isPending, stakeError: m.error };
}

/** Add tokens to an existing pool position. */
export function useAddToPoolMutation() {
  const { wallet } = useZapContext();
  const m = useMutation({
    mutationFn: async (params: { poolAddress: Address; amount: Amount }) => {
      if (!wallet) throw new Error("Wallet not connected.");
      const tx = await wallet.addToPool(params.poolAddress, params.amount);
      await tx.wait();
      return tx;
    },
  });
  return {
    addToPool: m.mutateAsync,
    isAddingToPool: m.isPending,
    addToPoolError: m.error,
  };
}

/** Claim pool rewards (checks position first, throws if zero rewards). */
export function useClaimRewardMutation() {
  const { wallet } = useZapContext();
  const m = useMutation({
    mutationFn: async (poolAddress: Address) => {
      if (!wallet) throw new Error("Wallet not connected.");
      const position = await wallet.getPoolPosition(poolAddress);
      if (!position || position.rewards.isZero()) throw new Error("No rewards to claim.");
      const tx = await wallet.claimPoolRewards(poolAddress);
      await tx.wait();
      return tx;
    },
  });
  return {
    claimReward: m.mutateAsync,
    isClaiming: m.isPending,
    claimError: m.error,
  };
}

/** Declare exit intent — starts the cooldown window. */
export function useExitIntentMutation() {
  const { wallet } = useZapContext();
  const m = useMutation({
    mutationFn: async (params: { poolAddress: Address; amount: Amount }) => {
      if (!wallet) throw new Error("Wallet not connected.");
      const tx = await wallet.exitPoolIntent(params.poolAddress, params.amount);
      await tx.wait();
      return tx;
    },
  });
  return {
    exitIntent: m.mutateAsync,
    isExitingIntent: m.isPending,
    exitIntentError: m.error,
  };
}

/** Complete withdrawal after the cooldown window has passed. */
export function useExitPoolMutation() {
  const { wallet } = useZapContext();
  const m = useMutation({
    mutationFn: async (poolAddress: Address) => {
      if (!wallet) throw new Error("Wallet not connected.");
      const tx = await wallet.exitPool(poolAddress);
      await tx.wait();
      return tx;
    },
  });
  return {
    exitPool: m.mutateAsync,
    isExiting: m.isPending,
    exitError: m.error,
  };
}

// ─── Composed all-in-one hook ──────────────────────────────────────────────────────────────────
// Composes all standalone hooks above. TanStack Query deduplicates fetches
// by queryKey, so subscribing here costs nothing if the standalone hooks
// are already mounted.
export function useStaking() {
  const { wallet } = useZapContext();

  const stakeM = useStakeMutation();
  const addToPoolM = useAddToPoolMutation();
  const claimM = useClaimRewardMutation();
  const exitIntentM = useExitIntentMutation();
  const exitPoolM = useExitPoolMutation();

  const isPending =
    stakeM.isStaking ||
    addToPoolM.isAddingToPool ||
    claimM.isClaiming ||
    exitIntentM.isExitingIntent ||
    exitPoolM.isExiting;

  const error: Error | null =
    stakeM.stakeError ??
    addToPoolM.addToPoolError ??
    claimM.claimError ??
    exitIntentM.exitIntentError ??
    exitPoolM.exitError ??
    null;

  return {
    // ─── Position helpers (imperative — call wallet directly) ───────────────
    getPosition: (poolAddress: Address): Promise<PoolMember | null> => {
      if (!wallet) throw new Error("Wallet not connected.");
      return wallet.getPoolPosition(poolAddress);
    },
    getCommission: (poolAddress: Address): Promise<number> => {
      if (!wallet) throw new Error("Wallet not connected.");
      return wallet.getPoolCommission(poolAddress);
    },
    isPoolMember: (poolAddress: Address): Promise<boolean> => {
      if (!wallet) throw new Error("Wallet not connected.");
      return wallet.isPoolMember(poolAddress);
    },

    // ─── Mutations ──────────────────────────────────────────────────────────
    stake: stakeM.stake,
    addToPool: addToPoolM.addToPool,
    claimReward: claimM.claimReward,
    exitIntent: exitIntentM.exitIntent,
    exitPool: exitPoolM.exitPool,

    // ─── Loading states ─────────────────────────────────────────────────────
    isPending,
    isStaking: stakeM.isStaking,
    isClaiming: claimM.isClaiming,
    isExiting: exitIntentM.isExitingIntent || exitPoolM.isExiting,
    error,
  };
}
