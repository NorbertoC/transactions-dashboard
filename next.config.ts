import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuration optimized for Cloudflare Pages
  
  // Enable static export for pages but keep API routes as functions
  trailingSlash: true,
  
  // Optimize images for Cloudflare
  images: {
    unoptimized: true,
  },
  
  // Optimize for Cloudflare Pages
  compress: true,
  
  // Disable webpack cache for production builds to avoid size issues
  webpack: (config, { dev }) => {
    if (!dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
