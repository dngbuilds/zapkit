import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  typescript: {
    // Registry source templates import shadcn UI components that aren't
    // installed in the doc app — they're only used by `shadcn build`.
    ignoreBuildErrors: true,
  },
};

const withMDX = createMDX();

export default withMDX(config);
