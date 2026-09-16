import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 writes AGENTS.md/CLAUDE.md on every dev start; keep the repo free of generated files.
  agentRules: false,
};

export default nextConfig;
