import type { NextConfig } from "next";

// Allow `next/image` to optimize remote previews coming from Backblaze B2.
// Presigned download URLs use the bucket-specific S3 hostname pattern:
//   <bucket>.s3.<region>.backblazeb2.com    (path-style and virtual-host)
//   s3.<region>.backblazeb2.com             (path-style)
// One wildcard covers every region + bucket, so this config drops in
// without per-deployment tweaks.
const nextConfig: NextConfig = {
  transpilePackages: ["@mujoco-rollout-dataset/shared"],
  // Dev-only cross-origin allowlist for Next's own dev assets (/_next/*).
  // `playwright.config.ts` deliberately drives the app at 127.0.0.1 (not
  // localhost) to dodge a macOS ::1 miss; without this, a browser opened at
  // that origin gets its dev-asset requests blocked and the client JS never
  // hydrates. Keep both hosts the app is actually served/verified on.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.backblazeb2.com",
      },
    ],
  },
};

export default nextConfig;
