/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Cloudflare Pages configuration
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
