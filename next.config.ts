import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: { cpus: 1 },
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ['bcryptjs'],
  eslint: { ignoreDuringBuilds: true },
  webpack(config) {
    // linkedom's optional canvas implementation is unused by HTML sanitization.
    config.resolve.alias = { ...config.resolve.alias, canvas: false }
    return config
  },
}

export default nextConfig
