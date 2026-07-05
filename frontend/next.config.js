/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /* Disable linting during build to speed up development verification if needed */
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

module.exports = nextConfig;
