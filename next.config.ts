import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuration for Cloudflare Pages
  distDir: '.next',
  
  // Optimize for Cloudflare Pages
  compress: true,
  
  // Disable webpack cache for production builds
  webpack: (config, { dev }) => {
    if (!dev) {
      // Disable webpack cache in production to avoid large cache files
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
