import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exportação estática: o site resultante (pasta `out/`) pode ser servido em qualquer alojamento estático.
  output: "export",
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
