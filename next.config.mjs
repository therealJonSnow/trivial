import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Serwist's injection step is incompatible with `next dev`; enable only for builds.
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: true,
  // Static export cannot use the Next image optimiser.
  images: { unoptimized: true },
};

export default withSerwist(nextConfig);
