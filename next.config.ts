import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Strip console.log in production builds
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.cloudinary.com" },
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "api.mapbox.com" },
    ],
    // Use modern formats and limit sizes
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400, // 24 hours
  },

  // Long-term caching for static assets
  async headers() {
    return [
      {
        source: "/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif|woff|woff2|ttf)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },

  // Opt heavy packages out of server-side bundling
  serverExternalPackages: ["mongoose"],

  experimental: {
    // Enable optimized package imports to reduce bundle size
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "recharts",
      "react-map-gl",
    ],
  },
};

export default nextConfig;
