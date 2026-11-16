import type { NextConfig } from "next";

import { MAX_IMPORT_BYTES } from "./src/app/app/imports/limits";

/** Multipart boundaries/headers; docs suggest 10–20 KB headroom above the file limit. */
const MULTIPART_OVERHEAD_BYTES = 20 * 1024;

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: MAX_IMPORT_BYTES + MULTIPART_OVERHEAD_BYTES,
    },
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
