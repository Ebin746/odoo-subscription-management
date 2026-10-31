import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Billing endpoints live in the Express backend; the UI calls them same-origin.
  async rewrites() {
    const backend = process.env.BACKEND_URL || "http://localhost:5000";
    return ["taxes", "discounts", "invoices"].map((name) => ({
      source: `/api/${name}/:path*`,
      destination: `${backend}/api/${name}/:path*`,
    }));
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
