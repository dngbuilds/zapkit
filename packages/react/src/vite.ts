/**
 * Vite plugin for ZapKit — resolves optional starkzap peer dependencies to
 * no-op shims so your app bundles without errors even when those packages
 * aren't installed. Also applies ethers v5→v6 compatibility patches for
 * transitive dependencies that still use the old `utils` namespace.
 *
 * Shims are injected at **two** levels:
 * 1. **esbuild plugin** inside `optimizeDeps` — intercepts the imports while
 *    Vite pre-bundles `starkzap` and its dependency graph.
 * 2. **Vite `resolveId`/`load` hooks** — catches any imports that slip through
 *    outside pre-bundling (SSR, non-optimized paths, etc.).
 *
 * Optional starkzap dependencies covered:
 *   @avnu/avnu-sdk          — AVNU swap / DCA routing
 *   @fatsolutions/tongo-sdk — TON bridge (confidential transactions)
 *   @hyperlane-xyz/sdk      — Hyperlane bridge (type-only, no runtime shim needed)
 *   @solana/web3.js         — Solana bridge (dynamically imported by starkzap)
 *
 * NOT shimmed (bundled as real deps in @zapkit/core):
 *   @cartridge/controller   — included automatically, OnboardStrategy.Cartridge works out of the box
 *
 * Ethers v5→v6 compat (automatic, no consumer action required):
 *   @hyperlane-xyz/multicollateral uses `import { utils } from "ethers"` (v5 API).
 *   The plugin rewrites those imports to use a compat shim backed by ethers v6.
 *
 * @example
 * // vite.config.ts
 * import { defineConfig } from "vite";
 * import { zapkitPlugin } from "@zapkit/core/vite";
 *
 * export default defineConfig({
 *   plugins: [zapkitPlugin()],
 * });
 */

const VIRTUAL_PREFIX = "\0zapkit-shim:";

/**
 * Virtual module ID for the ethers v5→v6 utils compat shim.
 * Provides the `utils` namespace that old deps import from ethers v5.
 */
const ETHERS_V5_UTILS_VIRTUAL = "\0zapkit:ethers-v5-utils";

/**
 * Inline code for the ethers v5 `utils` compat shim.
 * Maps the most-used ethers v5 utils surface to ethers v6 equivalents.
 * The consumer's installed ethers v6 package is used at runtime.
 */
const ETHERS_V5_UTILS_SHIM = `
import {
  hexlify, zeroPadValue, zeroPadBytes, getBytes, concat,
  AbiCoder, Interface,
  parseUnits, formatUnits, parseEther, formatEther,
  getAddress, isAddress,
  id, keccak256, solidityPackedKeccak256, solidityPacked,
  toUtf8Bytes, toUtf8String,
  namehash, Signature,
} from "ethers";

const utils = {
  hexlify,
  hexZeroPad: zeroPadValue,
  zeroPad: zeroPadBytes,
  arrayify: getBytes,
  concat,
  defaultAbiCoder: AbiCoder.defaultAbiCoder(),
  Interface,
  parseUnits, formatUnits, parseEther, formatEther,
  getAddress, isAddress,
  id, keccak256,
  solidityKeccak256: solidityPackedKeccak256,
  solidityPack: solidityPacked,
  toUtf8Bytes, toUtf8String,
  namehash,
  splitSignature: Signature.from.bind(Signature),
  joinSignature: (sig) => Signature.from(sig).serialized,
};
export default utils;
`;

/** Shim source code keyed by package name */
const SHIMS: Record<string, string> = {
  "@fatsolutions/tongo-sdk": `
export class Account {
  constructor() {
    throw new Error("[zapkit] @fatsolutions/tongo-sdk is not available. Install it to use TON bridge features.");
  }
}
export default {};
`,
  "@hyperlane-xyz/sdk": `
export const TOKEN_HYP_STANDARDS = [];
export const TokenStandard = {};
export const ChainMetadataSchema = {
  parse: () => ({}),
  safeParse: () => ({ success: true, data: {} }),
};
export default {};
`,
  "@solana/web3.js": `
export class PublicKey {
  constructor(_v) { this._v = _v; }
  toString() { return ''; }
  toBase58() { return ''; }
  toBuffer() { return new Uint8Array(32); }
  equals(_other) { return false; }
  static findProgramAddressSync() { return [new PublicKey(0), 0]; }
  static createProgramAddressSync() { return new PublicKey(0); }
}
export class Connection {
  constructor() {}
}
export class Transaction {
  constructor() {}
}
export default {};
`,
  "@avnu/avnu-sdk": `
const notInstalled = (name) => () => {
  throw new Error(\`[zapkit] @avnu/avnu-sdk "\${name}" is not available. Install @avnu/avnu-sdk to use swap/DCA features.\`);
};
export const getQuotes = notInstalled("getQuotes");
export const quoteToCalls = notInstalled("quoteToCalls");
export const cancelDcaToCalls = notInstalled("cancelDcaToCalls");
export const createDcaToCalls = notInstalled("createDcaToCalls");
export const getDcaOrders = notInstalled("getDcaOrders");
export const DcaOrderStatus = {};
export const BASE_URL = "https://starknet.api.avnu.fi";
export const SEPOLIA_BASE_URL = "https://sepolia.api.avnu.fi";
export default {};
`,
};

const SHIMMED_IDS = Object.keys(SHIMS);

/** Returns true when the package cannot be resolved from the given root (i.e. not installed). */
function isNotInstalled(packageId: string, root: string): boolean {
  try {
    // Use Node's require.resolve to check if the package is actually installed.
    require.resolve(packageId, { paths: [root] });
    return false; // found — do NOT shim
  } catch {
    return true; // not found — apply shim
  }
}

export function zapkitPlugin() {
  let projectRoot = process.cwd();

  return {
    name: "zapkit",

    configResolved(config: { root: string }) {
      projectRoot = config.root;
    },

    config() {
      // Build the set of shims only for packages that aren't actually installed.
      const activeShims: Record<string, string> = {};
      for (const id of SHIMMED_IDS) {
        if (isNotInstalled(id, projectRoot)) {
          activeShims[id] = SHIMS[id];
        }
      }

      // Simple (non-null-prefixed) virtual ID for the optimizeDeps pipeline.
      const ETHERS_COMPAT_ID = "zapkit:ethers-v5-utils-compat";

      return {
        optimizeDeps: {
          rolldownOptions: {
            plugins: [
              {
                name: "zapkit-shim",
                resolveId(id: string) {
                  if (id === ETHERS_COMPAT_ID) return { id: ETHERS_COMPAT_ID };
                  if (id in activeShims) return { id: VIRTUAL_PREFIX + id };
                  return undefined;
                },
                load(id: string) {
                  if (id === ETHERS_COMPAT_ID) return ETHERS_V5_UTILS_SHIM;
                  if (id.startsWith(VIRTUAL_PREFIX)) {
                    const realId = id.slice(VIRTUAL_PREFIX.length);
                    return activeShims[realId];
                  }
                  return undefined;
                },
                transform(code: string, id: string) {
                  if (!id.includes("@hyperlane-xyz/multicollateral")) return null;
                  if (!code.includes('"ethers"') && !code.includes("'ethers'")) return null;

                  let changed = false;
                  const transformed = code.replace(
                    /import\s*\{([^}]+)\}\s*from\s*['"]ethers['"]/g,
                    (match: string, names: string) => {
                      const nameList = names
                        .split(",")
                        .map((n: string) => n.trim())
                        .filter(Boolean);
                      if (!nameList.includes("utils")) return match;

                      changed = true;
                      const rest = nameList.filter((n: string) => n !== "utils");
                      const restImport =
                        rest.length > 0 ? `import { ${rest.join(", ")} } from "ethers"` : "";
                      return `${restImport}${restImport ? ";" : ""}\nimport utils from "${ETHERS_COMPAT_ID}"`;
                    },
                  );
                  return changed ? { code: transformed, map: null } : null;
                },
              },
            ],
          },
        },
      };
    },

    // Vite resolveId/load hooks for non-optimized paths (SSR, linked packages, etc.)
    resolveId(id: string) {
      if (id === ETHERS_V5_UTILS_VIRTUAL) return ETHERS_V5_UTILS_VIRTUAL;
      if (SHIMMED_IDS.includes(id) && isNotInstalled(id, projectRoot)) return VIRTUAL_PREFIX + id;
      return undefined;
    },
    load(id: string) {
      if (id === ETHERS_V5_UTILS_VIRTUAL) return ETHERS_V5_UTILS_SHIM;
      if (id.startsWith(VIRTUAL_PREFIX)) {
        const realId = id.slice(VIRTUAL_PREFIX.length);
        return SHIMS[realId];
      }
      return undefined;
    },

    /**
     * Rewrite `import { utils, ... } from "ethers"` in
     * @hyperlane-xyz/multicollateral — which uses the ethers v5 `utils`
     * namespace — to use our compat shim. This runs transparently so
     * consumers never need any extra setup.
     */
    transform(code: string, id: string) {
      if (!id.includes("@hyperlane-xyz/multicollateral")) return null;
      if (!code.includes('"ethers"') && !code.includes("'ethers'")) return null;

      let changed = false;
      const transformed = code.replace(
        /import\s*\{([^}]+)\}\s*from\s*['"]ethers['"]/g,
        (match: string, names: string) => {
          const nameList = names
            .split(",")
            .map((n: string) => n.trim())
            .filter(Boolean);
          if (!nameList.includes("utils")) return match;

          changed = true;
          const rest = nameList.filter((n: string) => n !== "utils");
          const restImport = rest.length > 0 ? `import { ${rest.join(", ")} } from "ethers"` : "";
          return `${restImport}${restImport ? ";" : ""}\nimport utils from "${ETHERS_V5_UTILS_VIRTUAL}"`;
        },
      );

      return changed ? { code: transformed, map: null } : null;
    },
  };
}
