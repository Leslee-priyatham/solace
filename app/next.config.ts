import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The one-click launcher builds into its own folder so it never clashes with `npm run dev` (.next).
  distDir: process.env.SOLACE_DIST_DIR || ".next",
  // pdf-parse reads its bundled pdf.js at runtime; keep it out of the server bundle.
  serverExternalPackages: ["pdf-parse"],
  experimental: {
    // Client files, form/template PDFs and attachments go through server actions.
    serverActions: { bodySizeLimit: "50mb" },
  },
};

export default nextConfig;
