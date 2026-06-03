/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: true,
  // Static export cannot use the Next image optimiser.
  images: { unoptimized: true },
};

export default nextConfig;
