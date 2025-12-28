import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // For production Electron builds, use relative paths for file:// protocol
  ...(process.env.OUTPUT_MODE === 'export' ? {
    output: 'export',
    images: { unoptimized: true },
    // Use relative paths for assets to work with file:// protocol
    basePath: '',
    assetPrefix: './',
    trailingSlash: true,
  } : {}),
};

export default nextConfig;
