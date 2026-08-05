import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Placeholder lookbook photography. Deterministic per seed, so the grid
      // is stable across reloads. Swap for real garment renders (S3/Cloudinary)
      // once the segmentation + VTO pipeline is writing files.
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      // YouCam returns generated renders as signed URLs on their CDN.
      { protocol: "https", hostname: "**.perfectcorp.com" },
      { protocol: "https", hostname: "**.amazonaws.com" },
    ],
  },
};

export default nextConfig;
