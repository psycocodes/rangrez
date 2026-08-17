import type { NextConfig } from "next";

/** The weights, plus the one native binary a Linux x64 host actually loads. */
const ORT_TRACE = [
  "./models/u2netp.onnx",
  "./node_modules/onnxruntime-node/package.json",
  "./node_modules/onnxruntime-node/dist/**",
  "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**",
];

const nextConfig: NextConfig = {
  /**
   * Native and near-native packages the bundler must leave alone.
   *
   * `onnxruntime-node` loads a `.node` binary at runtime and `sharp` links
   * libvips; bundling either produces a build that looks fine and cannot find
   * its own binary. See lib/segment.ts.
   */
  serverExternalPackages: ["onnxruntime-node", "sharp"],

  /**
   * Things the tracer cannot see, and a deploy is broken without.
   *
   * lib/segment.ts reaches the runtime through `createRequire` and the weights
   * through a `process.cwd()` path. Both are deliberate — the require is what
   * lets a missing runtime degrade to the hand-written matte instead of
   * throwing — and both are invisible to static analysis, so the build traces
   * *zero* onnxruntime files and zero weights and the function ships without
   * either. The failure that produces is the worst shape available: it works
   * in dev, and in production every cutout silently comes back from the flood
   * fill with nobody told.
   *
   * Only the Linux x64 binary is named. The package carries six (~247MB all
   * told, enough on its own to exceed a serverless bundle); a Linux x64 host
   * loads one of them, at 32MB.
   */
  outputFileTracingIncludes: {
    "/api/extension/save": ORT_TRACE,
    "/api/extension/tryon": ORT_TRACE,
    "/api/look/step": ORT_TRACE,
    // The browser's matte — the avatar cutout and the client-side garment cut
    // both come through here. See lib/cutout.ts.
    "/api/matte": ORT_TRACE,
  },

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
      { protocol: "https", hostname: "api.dicebear.com" },
      // Google account pictures. `lh3` is the usual host, but Google rotates
      // across lh3…lh6 and serves some through the bare googleusercontent
      // domain, so the wildcard is the only form that does not intermittently
      // 400 on a perfectly good avatar.
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "googleusercontent.com" },
      { protocol: "https", hostname: "unavatar.io" },
      { protocol: "https", hostname: "*.unavatar.io" },
      { protocol: "https", hostname: "*.google.com" },
      { protocol: "https", hostname: "*.gravatar.com" },
    ],
  },
};

export default nextConfig;
