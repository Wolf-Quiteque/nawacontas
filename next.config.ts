import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Drivers de base de dados executados apenas no servidor (Node.js).
  serverExternalPackages: ["postgres", "@electric-sql/pglite"],
};

export default nextConfig;
